import cadquery as cq
import cq_gears
from pathlib import Path
import trimesh


# 创建一个直齿轮（spur gear）
gear_obj = cq_gears.SpurGear(
    teeth_number=20,   # 齿数
    module=1.0,        # 模数（mm）
    width=10,          # 齿宽（mm）
    bore_diameter=5    # 轴孔直径（mm）
)
# ✅ 提取 CadQuery 对象
gear_cq = gear_obj.build()  # 关键！这是 Workplane

# --- 路径设置 ---
SCRIPT_DIR = Path(__file__).parent
output_folder = SCRIPT_DIR.parent / "临时文件"
output_folder.mkdir(parents=True, exist_ok=True)  # 自动创建

stl_path = output_folder / "正齿轮.stl"
glb_path = output_folder / "正齿轮.glb"

# 导出为 STL（临时）
try:
    cq.exporters.export(gear_cq, str(stl_path), exportType=cq.exporters.ExportTypes.STL)
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