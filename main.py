import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid

import cv2
import dlib
import numpy as np
import time
from aiohttp import web
from av import VideoFrame
import aiohttp_cors
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.contrib.media import MediaBlackhole, MediaRecorder, MediaRelay

detector_face = None
predictor_face = None


def get_image_size(image):
    image_size = (image.shape[0], image.shape[1])
    return image_size


def get_face_landmarks(image, face_detector, shape_predictor):
    dets = face_detector(image, 1)
    if dets is None:
        return None
    if len(dets) == 0:
        return None
    shape = shape_predictor(image, dets[0])
    face_landmarks = np.array([[p.x, p.y] for p in shape.parts()])
    return face_landmarks


def get_face_mask(image_size, face_landmarks):
    mask = np.zeros(image_size, dtype=np.uint8)
    points = np.concatenate([face_landmarks[0:16], face_landmarks[26:17:-1]])
    cv2.fillPoly(img=mask, pts=[points], color=255)
    return mask


def get_affine_image(image1, image2, face_landmarks1, face_landmarks2):
    three_points_index = [18, 8, 25]
    M = cv2.getAffineTransform(face_landmarks1[three_points_index].astype(np.float32),
                               face_landmarks2[three_points_index].astype(np.float32))
    dsize = (image2.shape[1], image2.shape[0])
    affine_image = cv2.warpAffine(image1, M, dsize)
    return affine_image.astype(np.uint8)


def get_mask_center_point(image_mask):
    image_mask_index = np.argwhere(image_mask > 0)
    miny, minx = np.min(image_mask_index, axis=0)
    maxy, maxx = np.max(image_mask_index, axis=0)
    center_point = ((maxx + minx) // 2, (maxy + miny) // 2)
    return center_point


def get_mask_union(mask1, mask2):
    mask = np.min([mask1, mask2], axis=0)
    mask = ((cv2.blur(mask, (5, 5)) == 255) * 255).astype(np.uint8)
    mask = cv2.blur(mask, (3, 3)).astype(np.uint8)
    return mask


def skin_color_adjustment(im1, im2, mask=None):
    if mask is None:
        im1_ksize = 55
        im2_ksize = 55
        im1_factor = cv2.GaussianBlur(
            im1, (im1_ksize, im1_ksize), 0).astype(np.float)
        im2_factor = cv2.GaussianBlur(
            im2, (im2_ksize, im2_ksize), 0).astype(np.float)
    else:
        im1_face_image = cv2.bitwise_and(im1, im1, mask=mask)
        im2_face_image = cv2.bitwise_and(im2, im2, mask=mask)
        im1_factor = np.mean(im1_face_image, axis=(0, 1))
        im2_factor = np.mean(im2_face_image, axis=(0, 1))

    im1 = np.clip((im1.astype(np.float) * im2_factor /
                  np.clip(im1_factor, 1e-6, None)), 0, 255).astype(np.uint8)
    return im1


def load_detector():
    global detector_face
    global predictor_face
    if detector_face == None:
        detector_face = dlib.get_frontal_face_detector()
    if predictor_face == None:
        predictor_face = dlib.shape_predictor(
            r'./model/shape_predictor_68_face_landmarks.dat')


def load_landmarks(avatar):
    global detector_face
    global predictor_face
    im1 = cv2.imread('./avatars/' + avatar + '.png')
    im1 = cv2.resize(im1, (480, im1.shape[0] * 640 // im1.shape[1]))
    landmarks1 = get_face_landmarks(im1, detector_face, predictor_face)
    im1_size = get_image_size(im1)
    im1_mask = get_face_mask(im1_size, landmarks1)
    return im1, landmarks1, im1_mask


def face_avatar(frame, im1, landmarks1, im1_mask):
    global detector_face
    global predictor_face
    time_start = time.perf_counter()
    im2 = frame
    img_gray = cv2.cvtColor(src=im2, code=cv2.COLOR_BGR2GRAY)
    landmarks2 = get_face_landmarks(
        img_gray, detector_face, predictor_face)  # 68_face_landmarks
    time_end = time.perf_counter()
    #print(time_end - time_start)
    if landmarks2 is not None:
        im2_size = get_image_size(im2)
        im2_mask = get_face_mask(im2_size, landmarks2)

        affine_im1 = get_affine_image(im1, im2, landmarks1, landmarks2)
        affine_im1_mask = get_affine_image(
            im1_mask, im2, landmarks1, landmarks2)

        union_mask = get_mask_union(im2_mask, affine_im1_mask)
        #time_start = time.clock()
        #affine_im1 = skin_color_adjustment(affine_im1, im2, mask=union_mask)
        #time_end = time.clock()
        #print(time_end - time_start)
        point = get_mask_center_point(affine_im1_mask)
        seamless_im = cv2.seamlessClone(
            affine_im1, im2, mask=union_mask, p=point, flags=cv2.NORMAL_CLONE)
        return seamless_im
    else:
        return None


ROOT = os.path.dirname(__file__)

logger = logging.getLogger("pc")
pcs = set()
relay = MediaRelay()


class VideoTransformTrack(MediaStreamTrack):

    kind = "video"

    def __init__(self, track, transform):
        super().__init__()  # don't forget this!
        self.track = track
        self.avatar = transform
        self.im1, self.landmarks1, self.im1_mask = load_landmarks(self.avatar)
        self.skip_frame = 0
        self.new_frame = None

    async def recv(self):
        frame = await self.track.recv()
        if self.skip_frame == 0:
            img = frame.to_ndarray(format="bgr24")
            try:
                img = face_avatar(
                    img, self.im1, self.landmarks1, self.im1_mask)
            except:
                img = None
            if img is not None:
                self.new_frame = VideoFrame.from_ndarray(img, format="bgr24")
                self.new_frame.pts = frame.pts
                self.new_frame.time_base = frame.time_base
        self.skip_frame = self.skip_frame + 1
        self.skip_frame = self.skip_frame % 10
        if self.new_frame is None:
            return frame
        else:
            return self.new_frame


async def index(request):
    content = open(os.path.join(ROOT, "index.html"), "r").read()
    return web.Response(content_type="text/html", text=content)


async def javascript(request):
    content = open(os.path.join(ROOT, "client.js"), "r").read()
    return web.Response(content_type="application/javascript", text=content)


async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    #configuration = RTCConfiguration([
    #    RTCIceServer("stun:stun1.l.google.com:19302")
    #])

    pc = RTCPeerConnection() #configuration
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
        print("Track " + track.kind + " received")
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
    load_detector()
    logging.basicConfig(level=logging.INFO)
    web.run_app(
        app, access_log=None, host="0.0.0.0", port=8080, ssl_context=None
    )
