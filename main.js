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

// 7. 调整相机位置，让它看着立方体
camera.position.z = 3;

// 8.初始化控制器
const controls = new OrbitControls(camera, renderer.domElement);

// 9.启用阻尼（让旋转更顺滑）
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 10.处理窗口变化
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//加载外部gltf模型
const loader = new GLTFLoader();
loader.load(
    // 资源路径 (替换成你实际的 .glb 或 .gltf 文件路径)
    'models/cad_model.glb', 
    
    // 加载完成后的回调函数
    function(gltf) {
        // 3. 加载成功，将模型添加到场景中
        // 注意：gltf.scene 是整个场景对象
        scene.add(gltf.scene);

        // --- 可选：调整模型的位置、旋转或缩放 ---
        // gltf.scene.rotation.x = Math.PI / 2; // 如果模型是躺着的，可以旋转它
        // gltf.scene.scale.set(0.1, 0.1, 0.1); // 如果模型太大，缩小它

        // --- 可选：给模型添加坐标轴 ---
        // const axesHelper = new THREE.AxesHelper(5);
        // gltf.scene.add(axesHelper); 

        console.log('glTF 模型加载成功！');
    },
    
    // 加载进度回调 (可选)
    function(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    
    // 错误回调
    function(error) {
        console.error('加载失败:', error);
    }
);

// 5. 创建一个红色的立方体
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // 红色
const cube = new THREE.Mesh(geometry, material);
// 11. 给立方体添加坐标轴
const axesHelper = new THREE.AxesHelper(5);
cube.add(axesHelper); 
scene.add(cube);





// 11. 效果展示（让立方体转起来并渲染）
function animate() {
    requestAnimationFrame(animate);

    // 让立方体旋转
    //cube.rotation.x += 0.01;
    //cube.rotation.y += 0.01;
    // 更新控制器（必须！）
    controls.update();
    //渲染主场景
    renderer.render(scene, camera);
    // 渲染小场景（角落坐标轴）
    cornerRenderer.render(cornerScene, cornerCamera);
}
animate();