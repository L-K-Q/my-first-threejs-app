import cadquery as cq
import os
from pathlib import Path
import trimesh
from math import sin, cos, pi, floor
# --- 齿轮参数 ---
module = 1.5      # 模数
teeth = 8      # 齿数
thickness = 5    # 齿轮厚度
pressure_angle = 20 # 标准压力角（度）

# ==============================
# ✅ 手动实现渐开线齿轮（无依赖）
# ==============================
# define the generating function
def hypocycloid(t, r1, r2):
    return (
        (r1 - r2) * cos(t) + r2 * cos(r1 / r2 * t - t),
        (r1 - r2) * sin(t) + r2 * sin(-(r1 / r2 * t - t)),
    )


def epicycloid(t, r1, r2):
    return (
        (r1 + r2) * cos(t) - r2 * cos(r1 / r2 * t + t),
        (r1 + r2) * sin(t) - r2 * sin(r1 / r2 * t + t),
    )


def gear(t, r1=4, r2=1):
    if (-1) ** (1 + floor(t / 2 / pi * (r1 / r2))) < 0:
        return epicycloid(t, r1, r2)
    else:
        return hypocycloid(t, r1, r2)


# create the gear profile and extrude it
result = (
    cq.Workplane("XY")
    .parametricCurve(lambda t: gear(t * 2 * pi, 6, 1))
    .twistExtrude(15, 30)
    .faces(">Z")
    .workplane()
    .circle(2)
    .cutThruAll()
)
# --- 路径设置 ---
SCRIPT_DIR = Path(__file__).parent
output_folder = SCRIPT_DIR.parent / "临时文件"
output_folder.mkdir(parents=True, exist_ok=True)  # 自动创建

stl_path = output_folder / "摆线齿轮.stl"
glb_path = output_folder / "摆线齿轮.glb"

# 导出为 STL（临时）
try:
    cq.exporters.export(result, str(stl_path), exportType=cq.exporters.ExportTypes.STL)
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