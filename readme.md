# avatarify-webrtc

基于aiortc（webrtc的python实现）和dlib，采用服务器上的GPU计算资源实现动态换脸特效，使得云端算力的有效利用。

Demo：https://gitclone.com/aiit/avatarify-webrtc/ 

可在 https://gitclone.com/aiit 下载APP查看其他人脸特效

## 一、原理

### 1、webrtc

- web端使用/offer请求，与aiortc端服务协商webrtc数据传输参数，然后将视频流加到PeerConnection的track中

- aiortc端收到track的视频流，交由换脸模型逐帧转换，转化后的帧加到PeerConnection的track中，web端收到trace后显示

  参考了https://github.com/jcrisp88/flutter-webrtc_python-aiortc-opencv。

### 2、换脸

使用shape_predictor_68_face模型，识别人脸68个关键点，将脸图合并到原视频上。参考了https://blog.csdn.net/weixin_44152939/article/details/123866639。

### 3、udp透传

webrtc最难处理的就是udp透传，因为webrtc是p2p对等节点直接通讯，使用的是UDP，大多数设备都在防火墙后，没有公网IP，所以在使用中要用到stun（发现公网IP打通UDP端口）和turn（消息转发）技术，单纯使用stun，只有50%的几率能做到UDP透传，所以本示例中使用了coturn服务器进行了通讯中转。

## 二、环境安装

### 1、安装显卡驱动及conda环境

参照https://zhuanlan.zhihu.com/p/477687451的依赖组件部分。

### 2、建立python3.7虚拟环境

```shell
conda create -n opencv python=3.7
conda activate opencv
pip install -r requirements.txt
conda deactivate
模型文件比较大，从https://gitclone.com/download1/model/shape_predictor_68_face_landmarks.dat下载后放到model目录下。
```

### 3、运行

```shell
conda activate opencv
python main.py
然后在chrome中浏览：http://127.0.0.1:8080
```

注意：在本机测试只能用127.0.0.1，不能用实地址，因为chrome的摄像头有权限控制，如果客户端与服务器不在同一台机器上，则要用以下的文件加白名单。

- 打开chrome://flags/#unsafely-treat-insecure-origin-as-secure
- 查找Insecure origins treated as secure
- 将Disabled改为Enabled，填写相应的URL，多个URL用逗号隔开
- 修改后relaunch重启浏览器生效