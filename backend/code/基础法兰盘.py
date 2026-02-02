import cadquery as cq
import os
from pathlib import Path
import trimesh
# --- 参数定义区 (这是你的'设计变量') ---
outer_diameter = 100  # 外径
thickness = 20        # 厚度
center_hole_dia =50    # 中心孔
bolt_hole_dia = 10    # 螺栓孔直径
bolt_circle_dia = 80  # 螺栓分布圆直径
num_bolts = 6         # 螺栓孔数量
center_hole_depth = 25  # 尝试改为 15, 会变成盲孔
bolt_hole_depth = 25   # 尝试改为 25, 会变成通孔

# --- 建模代码 ---
# 1. 创建基础圆盘
result = (
    cq.Workplane("XY")           # 选择XY平面开始绘图
    .circle(outer_diameter / 2)  # 画外圆
    .extrude(thickness)          # 挤出厚度
)
# 2. 在顶面创建一个工作平面，用于后续所有孔操作
wp = result.faces(">Z").workplane()
# --- 处理中心孔 ---
if center_hole_depth >= thickness:
    # 深度 >= 厚度，打贯穿孔
    result = wp.hole(center_hole_dia)
else:
    # 深度 < 厚度，打盲孔
    result = wp.hole(center_hole_dia, depth=center_hole_depth)

# --- 处处理螺栓孔 ---
# 重新获取当前模型的顶面工作平面
wp_bolts = result.faces(">Z").workplane()
#判断是否打穿孔
if bolt_hole_depth >= thickness:
    # 打贯穿孔
    result = (
        wp_bolts
        # 使用 polarArray 定义螺栓孔位置，并直接在其上打孔
        .polarArray(
            radius=bolt_circle_dia / 2,
            startAngle=0,
            angle=360,
            count=num_bolts
        )
        .hole(bolt_hole_dia)  # 👈 关键：在 polarArray 定义的点上执行 hole()
    )
else:
    # 打盲孔
    result = (
        wp_bolts
        .polarArray(
            radius=bolt_circle_dia / 2,
            startAngle=0,
            angle=360,
            count=num_bolts
        )
        .hole(bolt_hole_dia, depth=bolt_hole_depth)  # 👈 关键：使用 hole()加depth参数
    )

# --- 路径设置 ---
SCRIPT_DIR = Path(__file__).parent
output_folder = SCRIPT_DIR.parent / "临时文件"
output_folder.mkdir(parents=True, exist_ok=True)  # 自动创建

stl_path = output_folder / "flange.stl"
glb_path = output_folder / "flange.glb"

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
