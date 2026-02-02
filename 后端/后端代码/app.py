# app.py
import os
os.environ["CI"] = "1"  # 告诉 CadQuery 运行在 CI/无头环境
os.environ["DISPLAY"] = ""  # 避免 GUI 初始化
import re
import tempfile
import json
from flask import Flask, request, jsonify
from vosk import Model, KaldiRecognizer
import wave
from pydub import AudioSegment  # 用于音频格式转换
import cadquery as cq
import trimesh
import cq_gears
import base64
from flask_cors import CORS  # ← 新增

app = Flask(__name__)
CORS(app)  # ← 新增：全局启用 CORS
# === 配置 ===
# 获取 app.py 所在目录
app_dir = os.path.dirname(os.path.abspath(__file__))        # ...\后端\后端代码
parent_dir = os.path.dirname(app_dir)                      # ...\后端
PROJECT_ROOT = os.path.dirname(parent_dir)                 # ...\my-first-threejs-app

VOSK_MODEL_PATH = os.path.join(PROJECT_ROOT, "model")

print(f"🔍 正在检查模型路径: {VOSK_MODEL_PATH}")
if not os.path.exists(VOSK_MODEL_PATH):
    raise RuntimeError("❌ 请下载 Vosk 中文模型并解压到项目根目录的 'model' 文件夹！")

# === 工具函数：语音识别（支持任意音频格式）===
def recognize_audio(input_path: str) -> str:
    """将任意音频转为 16kHz 单声道 WAV 并识别"""
    wav_path = input_path + ".converted.wav"
    try:
        # 转换音频
        audio = AudioSegment.from_file(input_path)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        audio.export(wav_path, format="wav")

        # Vosk 识别
        wf = wave.open(wav_path, "rb")
        rec = KaldiRecognizer(vosk_model, wf.getframerate())
        while True:
            data = wf.readframes(4000)
            if not data:
                break
            rec.AcceptWaveform(data)
        wf.close()

        result = json.loads(rec.FinalResult())
        return result.get("text", "").strip()
    finally:
        if os.path.exists(wav_path):
            os.unlink(wav_path)


# === 工具函数：CadQuery → GLB bytes ===
def cq_to_glb(cq_obj) -> bytes:
    # 步骤1: 导出 STL 到临时文件
    try:
        with tempfile.NamedTemporaryFile(suffix=".stl", delete=False) as tmp_stl:
            stl_path = tmp_stl.name
        cq.exporters.export(cq_obj, stl_path, exportType="STL")


        # 步骤2: 用 trimesh 加载（确保加载完成后文件句柄释放）
        mesh = trimesh.load(stl_path)
        if mesh.is_empty:
            raise ValueError("生成的网格为空")

        # 步骤3: 导出为 GLB 字节
        glb_data = mesh.export(file_type="glb")
        return glb_data

    finally:
        # 步骤4: 安全删除临时文件（即使出错也删）
        # 无论如何都尝试删除
        if stl_path and os.path.exists(stl_path):
            try:
                os.unlink(stl_path)
            except (OSError, PermissionError):
                # Windows 下偶尔仍会锁住，可忽略或稍后清理
                pass


# === 参数解析器 ===
def parse_command(text: str):
    """
    解析中文指令，返回 {type, params}
    支持:
      - "齿轮" / "正齿轮"
      - "20齿齿轮" / "模数1.5的齿轮" / "齿数30模数2宽度10的齿轮"
      - "立方体" / "10毫米立方体"
      - "圆柱" / "半径5高20的圆柱"
    """
    text = (
        text
        .replace(" ", "")
        .replace("毫米", "")
        .replace("mm", "")
        .replace("十", "10")
        .replace("九", "9")
        .replace("八", "8")
        .replace("七", "7")
        .replace("六", "6")
        .replace("五", "5")
        .replace("四", "4")
        .replace("三", "3")
        .replace("二", "2")
        .replace("一", "1")
        .replace("零", "0")
    )
    # 齿轮
    if "齿轮" in text or "正齿轮" in text or "直齿轮" in text:
        # 默认值
        teeth = 20
        module = 1.0
        width = 5.0
        bore = 3.0

        # 提取数字（支持整数和小数）
        teeth_match = re.search(r"(\d+)齿", text)
        if teeth_match:
            teeth = int(teeth_match.group(1))

        module_match = re.search(r"模数?([0-9]*\.?[0-9]+)", text)
        if module_match:
            module = float(module_match.group(1))

        width_match = re.search(r"宽?度?([0-9]*\.?[0-9]+)", text)
        if width_match:
            width = float(width_match.group(1))

        bore_match = re.search(r"(?:孔径|内径|轴径|中心孔直径)([0-9]*\.?[0-9]+)", text)
        if bore_match:
            bore = float(bore_match.group(1))

        return {
            "type": "gear",
            "params": {
                "teeth": teeth,
                "module": module,
                "width": width,
                "bore_diameter": bore
            }
        }

    # 立方体
    elif "立方体" in text or "方块" in text:
        size = 10.0
        size_match = re.search(r"(\d+\.?\d*)", text)
        if size_match:
            size = float(size_match.group(1))
        return {"type": "cube", "params": {"size": size}}

    # 圆柱
    elif "圆柱" in text or "柱体" in text:
        radius = 5.0
        height = 20.0
        radius_match = re.search(r"半径|直径?([0-9]*\.?[0-9]+)", text)
        if radius_match:
            val = float(radius_match.group(1))
            # 如果是直径，转半径
            if "直径" in radius_match.group(0):
                radius = val / 2
            else:
                radius = val
        height_match = re.search(r"高|高度?([0-9]*\.?[0-9]+)", text)
        if height_match:
            height = float(height_match.group(1))
        return {"type": "cylinder", "params": {"radius": radius, "height": height}}

    # 未知指令
    else:
        return None


# === CAD 生成器 ===
def create_cad_object(spec):
    """根据解析结果生成 CadQuery 对象"""
    obj_type = spec["type"]
    params = spec["params"]

    if obj_type == "gear":
        gear_obj = cq_gears.SpurGear(
            teeth_number=params["teeth"],# 齿数
            module=params["module"],# 模数（单位：mm）
            width=params["width"],# 齿轮厚度/齿宽（沿轴向的长度，单位：mm）
            #bore_diameter=params["bore_diameter"],# 中心孔直径（用于安装轴，单位：mm）
            helix_angle=0,# 螺旋角（斜齿轮用；0 表示直齿轮）
            clearance=0.1,# 顶隙（齿根与配对齿轮齿顶之间的最小间隙）
            backlash=0.05,# 齿侧间隙（啮合时齿面间的微小空隙）
            addendum_coefficient=1.0,# 齿顶高系数
            dedendum_coefficient=1.25# 齿根高系数
        )
        print("  → 调用 gear_obj.build() ...")
        raw_gear = gear_obj.build()  # 构建齿轮返回 cq.Workplane 对象（已 extrude 成 3D）
        wp = cq.Workplane(obj=raw_gear)
        # 如果需要中心孔
        if params["bore_diameter"] > 0:
            print(f"  → 打中心孔: 直径={params['bore_diameter']} mm")
            # 在 XY 平面中心，向下和向上各切一半厚度（确保贯穿）
            hole_radius = params["bore_diameter"] / 2
            half_width = params["width"] / 2

            result = (
                wp
                .faces(">Z")  # 选顶面
                .workplane()  # 在顶面创建新工作平面
                .circle(hole_radius)  # 画孔轮廓
                .cutBlind(-params["width"])  # 向下切穿整个厚度
            )
        else:
            result = wp
        print("  → 齿轮构建完成!")
        return result

    elif obj_type == "cube":
        s = params["size"]
        return cq.Workplane().box(s, s, s)

    elif obj_type == "cylinder":
        return cq.Workplane().circle(params["radius"]).extrude(params["height"])

    else:
        raise ValueError(f"不支持的类型: {obj_type}")


# === API 路由 1: 语音识别 ===
@app.route("/speech", methods=["POST"])
def speech_recognize():
    if "audio" not in request.files:
        return jsonify({"error": "缺少 audio 文件"}), 400

    audio_file = request.files["audio"]
    with tempfile.NamedTemporaryFile(delete=False) as tmp_in:
        audio_file.save(tmp_in.name)
        try:
            text = recognize_audio(tmp_in.name)
            return jsonify({"text": text})
        except Exception as e:
            return jsonify({"error": f"语音识别失败: {str(e)}"}), 500
        finally:
            if os.path.exists(tmp_in.name):
                os.unlink(tmp_in.name)


# === API 路由 2: 生成模型 ===
@app.route("/generate-model", methods=["POST"])
def generate_model():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "无效的 JSON 请求体"}), 400

        command = data.get("command", "").strip()
        if not command:
            return jsonify({"error": "指令为空"}), 400

        print(f"📝 接收到指令: '{command}'")

        # 解析指令
        spec = parse_command(command)
        if not spec:
            return jsonify({"error": "未识别到有效建模指令", "text": command}), 400

        print(f"🔧 解析结果: {spec}")

        # 生成 CAD 对象
        print("⚙️ 开始构建 CAD 模型...")
        cad_obj = create_cad_object(spec)
        print("✅ CAD 模型构建成功")

        # 转 GLB
        print("📦 正在导出为 GLB...")
        glb_bytes = cq_to_glb(cad_obj)
        glb_b64 = base64.b64encode(glb_bytes).decode('utf-8')
        print("✅ GLB 导出成功")

        return jsonify({
            "glb_base64": glb_b64,
            "command": command,
            "parsed": spec
        })

    except Exception as e:
        import traceback
        print("\n💥 模型生成过程中发生严重错误:")
        print("-" * 50)
        traceback.print_exc()  # 打印完整堆栈
        print("-" * 50)
        return jsonify({"error": f"服务器内部错误: {str(e)}"}), 500
# === 启动 ===
if __name__ == "__main__":
    app.run(host="0.0.0.0",debug=True, port=5000, threaded=False, use_reloader=False)