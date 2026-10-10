{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
  pythonRelaxDepsHook,
  scipy,
  librosa,
  soundfile,
  numpy,
  pyyaml,
  tqdm,
  requests,
  regex,
  websockets,
  omegaconf,
  hydra-core,
  modelscope,
  huggingface-hub,
  safetensors,
  transformers,
  tiktoken,
  sentencepiece,
  kaldiio,
  jieba,
  jamo,
  jaconv,
  umap-learn,
  rapidfuzz,
  torch-complex,
  tensorboardx,
  oss2,
}:
buildPythonPackage (finalAttrs: {
  pname = "funasr";
  version = "1.3.30";
  pyproject = true;

  src = fetchFromGitHub {
    owner = "modelscope";
    repo = "FunASR";
    tag = "v${finalAttrs.version}";
    hash = "sha256-utcPHH4mMKyvGNgK4XgxIbhFmnDsdRpETqc+R+5VvQc=";
  };

  build-system = [ setuptools ];
  nativeBuildInputs = [ pythonRelaxDepsHook ];

  # funasr 的 setup.py 把 pytest-runner 放进 setup_requires，pyproject-build
  # （--no-isolation）在 "Getting build dependencies for wheel" 阶段会校验它，
  # 而 pytest-runner 已从 nixpkgs 移除且并非真正的构建/运行期依赖，故直接从
  # setup.py 移除该条目。
  postPatch = ''
    substituteInPlace setup.py \
      --replace-fail '"pytest-runner",' ""
  '';

  # setup_requires 也可能渗入 wheel 元数据的 Requires-Dist；pytest-runner 非
  # 运行期依赖（其运行期依赖已在 dependencies 中显式列全），一并关闭运行期
  # 依赖校验以防万一。
  dontCheckRuntimeDeps = true;

  dependencies = [
    scipy
    librosa
    soundfile
    numpy
    pyyaml
    tqdm
    requests
    regex
    websockets
    omegaconf
    hydra-core
    modelscope
    huggingface-hub
    safetensors
    transformers
    tiktoken
    sentencepiece
    kaldiio
    jieba
    jamo
    jaconv
    umap-learn
    rapidfuzz
    torch-complex
    tensorboardx
    oss2
  ];

  pythonRelaxDeps = [ "torch-complex" ];

  doCheck = false;
  pythonImportsCheck = [ "funasr" ];

  meta = {
    description = "OpenAI-compatible speech recognition toolkit with WebSocket streaming";
    homepage = "https://github.com/modelscope/FunASR";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
})
