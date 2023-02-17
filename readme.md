# Avatarify-webrtc

基于aiortc（webrtc的python实现）和dlib，采用服务器上的GPU计算资源实现动态换脸特效，使得云端算力的有效利用。

Simple Demo：https://gitclone.com/aiit/avatarify-webrtc/ 

==**带avatar的会议**==（Meeting with avatar Demo）: https://gitclone.com/aiit/meeting

可在 https://aiit.gitclone.com/ 下载APP查看其他人脸特效

## 一、原理

### 1、webrtc

- web端使用/offer请求，与aiortc端服务协商webrtc数据传输参数，然后将视频流加到PeerConnection的track中

- aiortc端收到track的视频流，交由换脸模型逐帧转换，转化后的帧加到PeerConnection的track中，web端收到trace后显示

  参考了https://github.com/jcrisp88/flutter-webrtc_python-aiortc-opencv。

### 2、换脸

使用shape_predictor_68_face模型，识别人脸68个关键点，将脸图合并到原视频上。参考了https://blog.csdn.net/weixin_44152939/article/details/123866639。

### 3、表情跟随

使用了https://github.com/alievk/avatarify-python 技术，应用first-order-model模型。

### 4、udp透传

webrtc最难处理的就是udp透传，因为webrtc是p2p对等节点直接通讯，使用的是UDP，大多数设备都在防火墙后，没有公网IP，所以在使用中要用到stun（发现公网IP打通UDP端口）和turn（消息转发）技术，单纯使用stun，只有50%的几率能做到UDP透传，所以本示例中使用了coturn服务器进行了通讯中转。

## 二、环境安装

### 1、安装显卡驱动及conda环境

参照https://zhuanlan.zhihu.com/p/477687451的依赖组件部分。

### 2、下载代码并安装依赖包

```shell
# clone source code
git clone https://gitclone.com/github.com/git-cloner/avatarify-webrtc
cd avatarify-webrtc
git clone https://github.com/alievk/first-order-model.git fomm
# download models
模型文件比较大，从https://gitclone.com/download1/model/shape_predictor_68_face_landmarks.dat下载后放到model目录下。
下载https://gitclone.com/download1/model/vox-adv-cpk.pth.tar，放到项目根目录下。
# create avatarify envs,install requirements
conda create -n avatarify python=3.7
conda activate avatarify
pip install torch==1.7.1+cu110 torchvision==0.8.2+cu110 torchaudio==0.7.2 -f https://download.pytorch.org/whl/torch_stable.html 
pip install -r requirements.txt -i http://pypi.douban.com/simple --trusted-host=pypi.douban.com
pip install cmake -i http://pypi.douban.com/simple --trusted-host=pypi.douban.com
conda install -c conda-forge dlib
pip install cryptography==38.0.0 -i http://pypi.douban.com/simple --trusted-host=pypi.douban.com
cp simsun.ttc to /usr/share/fonts/msfonts
conda deactivate
```

### 3、运行测试

```shell
windows:run_windows.bat
linux:./run.sh
然后在chrome中浏览：http://127.0.0.1:8080
```

注意：在本机测试只能用127.0.0.1，不能用实际地址，因为chrome的摄像头有权限控制，如果客户端与服务器不在同一台机器上或未采用https连接，则要用以下的文件加白名单。

- 打开chrome://flags/#unsafely-treat-insecure-origin-as-secure
- 查找Insecure origins treated as secure
- 将Disabled改为Enabled，填写相应的URL，多个URL用逗号隔开
- 修改后relaunch重启浏览器生效

## 三、常见问题及解决方案

| 问题            | 解决方案                                                     |
| --------------- | ------------------------------------------------------------ |
| UDP透传问题     | 采用coturn服务，应用sub + turn相结合的方案                   |
| 算力性能问题    | 跳过一些帧，保证生成的视频能够追上原始帧                     |
| torch的版本问题 | 用pip install torch命令安装的是CPU版本的，如果要使用GPU，得用上文方法安装，用以下方法验证： |
|                 | python<br/>import torch<br/>print("torch.cuda.is_available:",torch.cuda.is_available(),torch.cuda.device_count())<br/>exit() |
| opencv安装      | opencv的安装依赖于gcc的版本和cmake，安装时根据提示检查依赖项 |

