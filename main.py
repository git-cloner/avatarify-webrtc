import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid
import urllib
from aiohttp import web
from av import VideoFrame
import aiohttp_cors
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.contrib.media import MediaBlackhole, MediaRecorder, MediaRelay
from afy.cam_fomm import fomm_load_predictor, fomm_change_face, fomm_change_frame, fomm_test_predictor, InitOutPipe, InitLiveKitCli
from faces import load_detector, load_landmarks, face_avatar


def parseTransParams(transform):
    params = transform.split("|")
    avatar = "1"
    avatar_type = "0"
    avatar_room = ""
    avatar_id = ""

    if len(params) == 0:
        avatar = "1"
    if len(params) >= 1:
        avatar = params[0]
    if len(params) >= 2:
        avatar_type = params[1]
    if len(params) >= 3:
        avatar_room = params[2]
    if len(params) >= 4:
        avatar_id = params[3]
    return avatar, avatar_type, avatar_room, avatar_id


ROOT = os.path.dirname(__file__)

logger = logging.getLogger("pc")
pcs = set()
relay = MediaRelay()


class VideoTransformTrack(MediaStreamTrack):

    kind = "video"

    def __init__(self, track, transform):
        super().__init__()  # don't forget this!
        # parse params
        self.avatar, self.avatar_type, self.avatar_room, self.avatar_id = parseTransParams(
            transform)
        self.track = track
        # load model
        if self.avatar_type == "0":
            self.im1, self.landmarks1, self.im1_mask = load_landmarks(
                self.avatar)
        elif self.avatar_type == "1":
            self.fomm_predictor, self.avatar_kp = fomm_load_predictor(
                self.avatar)
        else:
            self.fomm_predictor, self.avatar_kp = None, None
        # init var
        self.skip_frame = 0
        self.skip_detectface = 0
        self.new_frame = None
        self.last_x = 0
        self.last_y = 0
        self.last_w = 0
        self.last_h = 0
        # init pipe
        self.filename = ""
        self.livekit_cli_cmd = ""
        self.pipe = None
        self.livekit_cli_process = None
        if self.avatar_room != "":
            self.filename = '/tmp/' + self.avatar_room + '__' + \
                self.avatar_id + '__' + self.avatar + '.h264.sock'
            self.pipe = InitOutPipe(self.filename)
            self.livekit_cli_cmd = InitLiveKitCli(
                self.avatar_room, self.avatar_id, self.filename)

    def __del__(self):
        if self.pipe is not None:
            self.pipe.kill()
            print("ffmpeg pipe be killed")
        if self.livekit_cli_process is not None:
            if self.livekit_cli_process.pid != 0:
                self.livekit_cli_process.kill()
                print("livekit-cli be killed")
        return

    async def recv(self):
        frame = await self.track.recv()
        if self.avatar_type == "0":
            if self.skip_frame == 0:
                img = frame.to_ndarray(format="bgr24")
                try:
                    img = face_avatar(
                        img, self.im1, self.landmarks1, self.im1_mask)
                except Exception as e:
                    print(e)
                    img = None
                if img is not None:
                    self.new_frame = VideoFrame.from_ndarray(
                        img, format="bgr24")
                    self.new_frame.pts = frame.pts
                    self.new_frame.time_base = frame.time_base
            self.skip_frame = self.skip_frame + 1
            self.skip_frame = self.skip_frame % 10
            if self.new_frame is None:
                return frame
            else:
                return self.new_frame
        elif self.avatar_type == "1":
            if self.skip_frame == 0:
                is_detectface = (self.skip_detectface == 0)
                img = frame.to_ndarray(format="bgr24")
                try:
                    img, self.last_x, self.last_y, self.last_w, self.last_h = fomm_change_frame(
                        self.fomm_predictor, self.avatar_kp, img, self.last_x, self.last_y, self.last_w, self.last_h, is_detectface)
                except Exception as e:
                    print(e)
                    img = None
                if img is not None:
                    self.new_frame = VideoFrame.from_ndarray(
                        img[..., ::-1], format="bgr24")
                    if self.pipe is not None:
                        try:
                            self.pipe.stdin.write(img[..., ::-1].tobytes())
                        except Exception as e:
                            print(e)
                        try:
                            if self.livekit_cli_process is None:
                                if os.path.exists(self.filename):
                                    self.livekit_cli_process = subprocess.Popen(
                                        self.livekit_cli_cmd, shell=True)
                        except Exception as e:
                            print(e)
                    self.new_frame.pts = frame.pts
                    self.new_frame.time_base = frame.time_base
            self.skip_frame = self.skip_frame + 1
            self.skip_frame = self.skip_frame % 5
            self.skip_detectface = self.skip_detectface + 1
            self.skip_detectface = self.skip_detectface % 30
            if self.new_frame is None:
                return frame
            else:
                return self.new_frame
        else:
            return frame


async def index(request):
    content = open(os.path.join(ROOT, "index.html"),
                   "r", encoding='utf-8').read()
    logger.info("index for %s", request.remote)
    return web.Response(content_type="text/html", text=content)


async def javascript(request):
    content = open(os.path.join(ROOT, "client.js"),
                   "r", encoding='utf-8').read()
    return web.Response(content_type="application/javascript", text=content)


async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    configuration = RTCConfiguration([
        # RTCIceServer("stun:stun1.l.google.com:19302")
        RTCIceServer("turn:gitclone.com:3478", "webrtc", "Webrtc987123654")
    ])

    pc = RTCPeerConnection(configuration)
    pc_id = "PeerConnection(%s)" % uuid.uuid4()
    pcs.add(pc)

    def log_info(msg, *args):
        logger.info(pc_id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            if isinstance(message, str) and message.startswith("ping"):
                channel.send("pong" + message[4:])

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)
        if track.kind == "video":
            pc.addTrack(
                VideoTransformTrack(
                    relay.subscribe(track), transform=params["avatar"]
                )
            )

        @track.on("ended")
        async def on_ended():
            log_info("Track %s ended", track.kind)

    # handle offer
    await pc.setRemoteDescription(offer)

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )


async def on_shutdown(app):
    # close peer connections
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


app = web.Application()
cors = aiohttp_cors.setup(app)
app.on_shutdown.append(on_shutdown)
app.router.add_get("/", index)
app.router.add_get("/client.js", javascript)
app.router.add_post("/offer", offer)
app.router.add_static('/avatars/',
                      path='avatars',
                      name='avatars')

for route in list(app.router.routes()):
    cors.add(route, {
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=True,
            expose_headers="*",
            allow_headers="*",
            allow_methods="*"
        )
    })

if __name__ == "__main__":
    # fomm_test_predictor()
    load_detector()
    logging.basicConfig(level=logging.INFO)
    web.run_app(
        app, access_log=None, host="0.0.0.0", port=8080, ssl_context=None
    )
