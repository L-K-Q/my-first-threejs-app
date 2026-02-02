import cadquery as cq
import os
from pathlib import Path
import trimesh
# --- 参数定义区 ---
plate_length = 80    # 板长
plate_width = 60     # 板宽
plate_height = 10    # 板厚
center_hole_dia = 22 # 中心轴孔
margin = 10          # 边距

# --- 建模代码 ---
result = (
    cq.Workplane("XY")
    .box(plate_length, plate_width, plate_height)  # 创建长方体底座
    .faces(">Z")                                    # 选择顶面
    .workplane()                                    # 创建工作平面
    .hole(center_hole_dia)                          # 打中心孔
    # 在四个角打安装孔 (使用 pushPoints 批量操作)
    .pushPoints([
        (plate_length/2 - margin, plate_width/2 - margin),   # 右上
        (plate_length/2 - margin, -plate_width/2 + margin),  # 右下
        (-plate_length/2 + margin, plate_width/2 - margin), # 左上
        (-plate_length/2 + margin, -plate_width/2 + margin) # 左下
    ])
    .hole(5)  # 打4个直径为5mm的安装孔
)
# --- 路径设置 ---
SCRIPT_DIR = Path(__file__).parent
output_folder = SCRIPT_DIR.parent / "临时文件"
output_folder.mkdir(parents=True, exist_ok=True)  # 自动创建

stl_path = output_folder / "带孔矩形板.stl"
glb_path = output_folder / "带孔矩形板.glb"

# 导出为 STL（临时）
try:
    cq.exporters.export(result.val(), str(stl_path), exportType=cq.exporters.ExportTypes.STL)
    print(f"✅ STL 已导出: {stl_path}")
except Exception as e:
    print(f"❌ STL 导出失败: {e}")
# 使用 trimesh 将 STL 转为 GLB
try:
    mesh = trimesh.load(str(stl_path))
    if not mesh.is_empty:
        mesh.export(str(glb_path))
        print(f"✅ GLB 已保存至: {glb_path}")
    else:
        print("❌ 网格为空，无法导出！")
except Exception as e:
    print(f"❌ GLB 转换失败: {e}")