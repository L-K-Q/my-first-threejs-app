// 1. 导入 Three.js
import * as THREE from '../node_modules/three/build/three.module.js'

//2. 初始化轨道控制插件
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';

//3.导入GLTF加载器
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';

// 2. 初始化场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa); // 改个灰色背景方便看


//3.初始化相机
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;// 把相机往后拉一点

//4.初始化渲染器
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 6. 添加光照（没有光，标准材质会是黑的）
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1).normalize();
scene.add(light);

// 7. 调整相机位置，让它看着物体
camera.position.z = 3;

// 8.初始化控制器
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;//启用阻尼（让旋转更顺滑）
controls.dampingFactor = 0.05;

// 10.处理窗口变化
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========== 模型路径映射 ==========
const MODEL_PATHS = {
  gear: '后端/临时文件/正齿轮.glb',
  // cube: '后端/临时文件/立方体.glb',
  // sprocket: '后端/临时文件/链轮.glb'
};

// ========== 清理场景 ==========
function clearScene() {
  const toRemove = [];// 创建一个数组来存储需要移除的对象
  // 遍历场景中的所有对象
  scene.traverse(obj => {
    // 检查对象是否具有CAD零件标记或坐标轴标记
    if (obj.userData?.isCADPart || obj.userData?.isCoordinateAxis) {
    // 将符合条件的对象添加到待移除列表
      toRemove.push(obj);
    }
  });
    // 从场景中移除所有标记的对象
  toRemove.forEach(obj => scene.remove(obj));
}

// ========== 添加坐标轴 ==========
function addCoordinateAxes(length) {
    // 定义六个轴线的数据：X轴(负正)、Y轴(负正)、Z轴(负正)
  const axes = [
    { from: [-length, 0, 0], to: [0, 0, 0], color: 0xff0000 },// X轴负方向（红色
    { from: [0, 0, 0], to: [length, 0, 0], color: 0xff4444 },// X轴正方向（红色）
    { from: [0, -length, 0], to: [0, 0, 0], color: 0x00ff00 },// Y轴负方向（绿色）
    { from: [0, 0, 0], to: [0, length, 0], color: 0x44ff44 },// Y轴正方向（绿色）
    { from: [0, 0, -length], to: [0, 0, 0], color: 0x0000ff },// Z轴负方向（蓝色）
    { from: [0, 0, 0], to: [0, 0, length], color: 0x4444ff }// Z轴正方向（蓝色）
  ];
// 为每条轴线创建几何体、材质和线条对象
  axes.forEach(axis => {
    // 创建线段几何体
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...axis.from),// 起始点（负方向）
      new THREE.Vector3(...axis.to)// 终止点（正方向）
    ]);
    // 创建线段材质（使用指定颜色）
    const material = new THREE.LineBasicMaterial({ color: axis.color });
    // 创建线段对象
    const line = new THREE.Line(geometry, material);
    // 为线段添加用户数据标记，标识其为坐标轴
    line.userData = { isCoordinateAxis: true };
    // 将线段添加到场景中
    scene.add(line);
  });
}

// ========== 核心：加载模型函数 ==========
export function loadModelByType(modelType) {
  const path = MODEL_PATHS[modelType];// 获取模型路径
  if (!path) {
    // 如果找不到对应模型路径，输出警告信息
    console.warn(`❌ 未知模型类型: ${modelType}`);
    return;
  }

  clearScene(); // 清除旧模型和坐标轴

  const loader = new GLTFLoader();// 创建GLTF加载器实例
  // 异步加载模型文件
  loader.load(
    path,
    // 成功加载后的回调函数
    (gltf) => {
       // 为模型场景添加用户数据标记，标识其为CAD零件
      gltf.scene.userData = { isCADPart: true };
      scene.add(gltf.scene);// 将加载的模型添加到场景中

      // 自动对焦
      const box = new THREE.Box3().setFromObject(gltf.scene);// 计算模型边界框
      const size = box.getSize(new THREE.Vector3());// 获取模型尺寸
      const maxDim = Math.max(size.x, size.y, size.z);// 获取最大维度
      const fov = camera.fov * (Math.PI / 180);// 将相机视野角度转换为弧度
      const cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) / 2 * 1.5;// 计算合适的相机距离
      const center = box.getCenter(new THREE.Vector3());// 获取模型中心点
    // 设置相机位置，围绕模型中心
      camera.position.copy(center);
      camera.position.x += cameraZ;
      camera.position.y += cameraZ / 4;
      camera.position.z += cameraZ;
      camera.lookAt(center);// 相机看向模型中心
      controls.target.copy(center);// 设置控制器的目标点
      controls.update();

      // 派发初始状态事件（供 UI 重置相机）
      window.dispatchEvent(new CustomEvent('cameraInitialReady', {
        detail: {
          initialPosition: camera.position.clone(),// 初始相机位置
          initialTarget: controls.target.clone()// 初始目标点
        }
      }));

      // 派发模型+参数事件（供 UI 显示参数面板）
      // 🔜 后端接入点 1：这里应从 API 获取真实参数
      const params = DEFAULT_PARAMS[modelType] || {};//将 DEFAULT_PARAMS[modelType] 替换为从 /gear 接口获取的真实参数。
      window.dispatchEvent(new CustomEvent('modelLoadedWithParams', {
        detail: { partType: modelType, params }
      }));

      // 添加坐标轴辅助器，大小基于模型尺寸
      addCoordinateAxes(maxDim * 1.2);
      // 输出成功日志
      console.log(`✅ 模型 "${modelType}" 加载成功！`);
    },
    undefined,// 进度回调（未使用）
    (error) => {
        // 加载失败时的错误处理
      console.error(`❌ 模型 "${modelType}" 加载失败:`, error);
      // 触发错误事件，传递错误详情
      window.dispatchEvent(new CustomEvent('modelLoadError', { detail: { modelType, error } }));
    }
  );
}
// ========== 核心：从 Base64 GLB 动态加载模型 ==========
export function updateSceneWithGLB(glbBytes) {
  clearScene(); // 清除旧模型和坐标轴

  const loader = new GLTFLoader();
  const uint8Array = glbBytes; // Uint8Array
  const buffer = uint8Array.buffer.slice(
    uint8Array.byteOffset,
    uint8Array.byteLength + uint8Array.byteOffset
  );

  loader.parse(
    buffer,
    '', // base path (empty for in-memory)
    (gltf) => {
      gltf.scene.userData = { isCADPart: true };
      scene.add(gltf.scene);

      // === 相机自动对焦（复用原有逻辑）===
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) / 2 * 1.5;
      const center = box.getCenter(new THREE.Vector3());

      camera.position.copy(center);
      camera.position.x += cameraZ;
      camera.position.y += cameraZ / 4;
      camera.position.z += cameraZ;
      camera.lookAt(center);
      controls.target.copy(center);
      controls.update();

      // 派发初始状态事件（供 UI 重置相机）
      window.dispatchEvent(new CustomEvent('cameraInitialReady', {
        detail: {
          initialPosition: camera.position.clone(),
          initialTarget: controls.target.clone()
        }
      }));

      // 🔥 注意：这里无法知道具体参数，所以不派发 modelLoadedWithParams
      // 如果需要，可让后端返回 parsed.params 并由 ui.js 触发

      // 添加坐标轴
      addCoordinateAxes(maxDim * 1.2);

      console.log('✅ 动态模型加载成功！');
    },
    undefined,
    (error) => {
      console.error('❌ 动态模型加载失败:', error);
      alert('模型加载失败，请重试');
    }
  );
}

// ========== 初始加载（可选）==========
// loadModelByType('gear'); // 如果需要默认加载

// ========== 动画循环 ==========
function animate() {
  // 请求浏览器在下次重绘时调用此函数，创建持续的动画循环
  requestAnimationFrame(animate);
  // 更新轨道控制器，处理用户交互（如鼠标拖动、缩放等）
  controls.update();
  // 让光源跟随相机位置，并在其基础上增加偏移量，确保光照方向与相机相关
  light.position.copy(camera.position).add(new THREE.Vector3(1, 1, 1));
  // 渲染场景，使用指定的相机视角
  renderer.render(scene, camera);
}
animate();

// ========== 导出 ==========
export { 
  scene, 
  camera, 
  controls, 
  renderer, 
  //loadModelByType,      // 可选保留
  //updateSceneWithGLB    // ✅ 必须导出！
};