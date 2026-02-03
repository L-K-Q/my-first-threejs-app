// ui.js - 独立的 UI 交互模块
import { loadModelByType, updateSceneWithGLB } from './main.js';

const BACKEND_URL = "https://tuition-extent-licence-pittsburgh.trycloudflare.com";
// 存储初始相机状态（等模型加载后再设置）
let initialCameraState = null;

// ====== 关键词到零件类型的映射 ======
const KEYWORD_TO_TYPE = {
  '齿轮': 'gear',
  '正齿轮': 'gear',
  '直齿轮': 'gear',
  // 可扩展：
  // '立方体': 'cube',
  // '链轮': 'sprocket'
};

const PART_CONFIGS = {
  gear: {
    label: '齿轮',
    fields: [
      { name: 'teeth', label: '齿数', min: 5, max: 200, step: 1, default: 20 },
      { name: 'module', label: '模数 (mm)', min: 0.1, max: 10, step: 0.1, default: 1.0 },
      { name: 'width', label: '宽度 (mm)', min: 1, max: 50, step: 0.5, default: 5 },
      { name: 'bore_diameter', label: '孔径 (mm)', min: 0, max: 20, step: 0.1, default: 3 }
    ]
  }
  // 未来可加：
  // sprocket: { ...
};
function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('❌ 当前浏览器不支持语音识别，请使用 Chrome 或 Edge');
    return;
  }

  // 请求麦克风权限
  try {
    navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert('⚠️ 请允许网站访问麦克风');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;

  const voiceBtn = document.getElementById('voice-btn');
  voiceBtn.textContent = '🎙️ 正在听...';
  voiceBtn.disabled = true;

  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    console.log('🗣️ 识别结果:', transcript);

    const speechInput = document.getElementById('speech-result');
    if (speechInput) {
      speechInput.value = transcript;
      const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
      speechInput.dispatchEvent(enterEvent);
    }

    voiceBtn.textContent = '🎤 语音建模';
    voiceBtn.disabled = false;
  };

  recognition.onerror = () => {
    alert('🎤 语音识别失败');
    voiceBtn.textContent = '🎤 语音建模';
    voiceBtn.disabled = false;
  };

  recognition.onend = () => {
    voiceBtn.textContent = '🎤 语音建模';
    voiceBtn.disabled = false;
  };
}
// ========== 显示参数面板 ==========
function showParamPanel(partType, params) {
  const config = PART_CONFIGS[partType];
  const panel = document.getElementById('param-panel');

  if (!config) {
    panel.style.display = 'none';
    return;
  }

  document.getElementById('param-title').textContent = `⚙️ ${config.label} 参数`;

  let html = '';
  config.fields.forEach(field => {
    const value = params[field.name] ?? field.default;
    html += `
      <div class="param-row">
        <label class="param-label">${field.label}:</label>
        <input type="number"
               id="param-${field.name}"
               min="${field.min}"
               max="${field.max}"
               step="${field.step}"
               value="${value}"
               class="param-input">
      </div>`;
  });
  document.getElementById('param-form').innerHTML = html;
  panel.style.display = 'block';

  // 绑定更新按钮
  const btn = document.getElementById('update-btn');
  btn.onclick = () => handleUpdateModel(config, partType);
}

// ========== 处理参数更新 ==========
function handleUpdateModel(config, partType) {
  const newParams = {};
  let valid = true;

  config.fields.forEach(field => {
    const input = document.getElementById(`param-${field.name}`);
    const val = parseFloat(input.value);
    if (isNaN(val) || val < field.min || val > field.max) {
      alert(`❌ ${field.label} 超出范围 [${field.min}, ${field.max}]`);
      valid = false;
      return;
    }
    newParams[field.name] = val;
  });

  if (!valid) return;

  // 🔜 后端接入点 2：调用 API 重新生成模型
  /*🔸 后端接入点 2：
取消注释 fetch('/gear', ...) 部分，对接你的 Flask/FastAPI 后端。*/
  /*
  fetch('/gear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newParams)
  })
  .then(res => res.json())
  .then(data => {
    // data 应包含 { glb_base64: "...", params: {...} }
    // 然后用 GLTFLoader 解析 base64 并替换场景中的模型
    alert('模型已更新！');
  })
  .catch(err => alert('后端错误: ' + err.message));
  */

  // ⚠️ 当前为模拟
  alert('✅ 参数已提交（需接入后端）\n' + JSON.stringify(newParams, null, 2));
}
// 初始化 UI
function initUI() {
  const speechInput = document.getElementById('speech-result');
  const resetBtn = document.getElementById('reset-camera');
  const voiceBtn = document.getElementById('voice-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', startSpeechRecognition); // ✅ 只绑定一次
  }
  // 监听模型加载完成（带参数）
  window.addEventListener('modelLoadedWithParams', (e) => {
    showParamPanel(e.detail.partType, e.detail.params);
  });

  // 监听相机初始状态
  window.addEventListener('cameraInitialReady', (e) => {
    initialCameraState = e.detail;
  });
// 文本框输入监听（支持回车触发）

  
  if (speechInput) {
    speechInput.addEventListener('keypress', async(e) => {
      if (e.key === 'Enter') {
        const text = speechInput.value.trim();
        if (!text) return;

        // 尝试匹配关键词
        let matchedType = null;
        for (const keyword in KEYWORD_TO_TYPE) {
          if (text.includes(keyword)) {
            matchedType = KEYWORD_TO_TYPE[keyword];
            break;
          }
        }

        if (matchedType) {
          console.log(`🗣️ 识别到命令: "${text}" → 加载模型: ${matchedType}`);
          
          // 使用 fetch 请求后端生成模型
          try {
            // 获取用户输入的完整文本（不是只传 partType）
            const userInput = speechInput.value.trim();

            const response = await fetch(`${BACKEND_URL}/generate-model`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json; charset=utf-8' // 👈 显式指定 UTF-8
              },
              body: JSON.stringify({ command: userInput })
            });
            const data = await response.json();

            if(response.ok){
              // 使用后端返回的 base64 glb 数据更新场景
              const glbBytes = new Uint8Array(atob(data.glb_base64).split('').map(char => char.charCodeAt(0)));
              updateSceneWithGLB(glbBytes);
            } else {
              console.error('模型生成失败:', data.message);
            }
          } catch (error) {
            console.error('请求错误:', error);
          }

          speechInput.value = ''; // 清空输入框
        } else {
          alert('⚠️ 未识别到有效零件命令（例如：“画个齿轮”）');
        }
      }
    });
  }

  // 重置相机按钮
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!initialCameraState) {
        console.warn('⚠️ 初始状态未就绪，请等待模型加载完成');
        return;
      }

      camera.position.copy(initialCameraState.initialPosition);
      controls.target.copy(initialCameraState.initialTarget);
      controls.update();
      console.log('🔄 相机已重置');
    });
  }
}

// 启动 UI
document.addEventListener('DOMContentLoaded', initUI);