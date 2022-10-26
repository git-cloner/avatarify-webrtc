import os
import sys
from sys import platform as _platform
import glob
import time
import dlib
import threading
#import torch
import numpy as np
import cv2
import torch
from afy.videocaptureasync import VideoCaptureAsync
from afy.arguments import opt
from afy.utils import info, Once, Tee, crop, pad_img, resize, TicToc
import afy.camera_selector as cam_selector
from afy import predictor_local


# Where to split an array from face_alignment to separate each landmark
LANDMARK_SLICE_ARRAY = np.array([17, 22, 27, 31, 36, 42, 48, 60])
face_detector = None
lock = None


def detect_face(image):
    global face_detector
    if face_detector is None:
        face_detector = dlib.get_frontal_face_detector()
    # Convert image into grayscale
    img_gray = cv2.cvtColor(src=image, code=cv2.COLOR_BGR2GRAY)
    # Use detector to find landmarks
    faces = face_detector(img_gray, 0)
    if len(faces) > 0:
        l = faces[0].left()
        t = faces[0].top()
        r = faces[0].right()
        b = faces[0].bottom()
        # init
        x = l
        y = t
        w = r - l
        h = b - y
        # adjust
        e = int(h / 3)
        y = y - e
        h = h + 2 * e
        f = int(w / 3)
        x = x - f
        w = w + 2 * f
        return [(x, y, w, h)]
    return []


def cut_image(img, box):
    (x, y, w, h) = box
    cropped = img[int(y):int(y + h), int(x):int(x + w)]  # [y0:y1, x0:x1]
    return cropped


def crop_face(image, face, last_x, last_y, last_w, last_h):
    shape = image.shape
    (x, y, w, h) = face
    if last_x > 0 and last_y > 0:
        if abs(last_x - x) < 60 and abs(last_y - y) < 60:
            x = last_x
            y = last_y
            w = last_w
            h = last_h
    face_image = cut_image(image, (x, y, w, h))
    return face_image, x, y, w, h


def is_new_frame_better(source, driving, predictor, avatar_kp):
    if avatar_kp is None:
        return False

    if predictor.get_start_frame() is None:
        return True

    driving_smaller = resize(driving, (128, 128))[..., :3]
    new_kp = predictor.get_frame_kp(driving)

    if new_kp is not None:
        new_norm = (np.abs(avatar_kp - new_kp) ** 2).sum()
        old_norm = (
            np.abs(avatar_kp - predictor.get_start_frame_kp()) ** 2).sum()

        out_string = "{0} : {1}".format(
            int(new_norm * 100), int(old_norm * 100))

        return new_norm < old_norm
    else:
        return False


def load_images(IMG_SIZE=256):
    avatars = []
    filenames = []
    images_list = sorted(glob.glob(f'./avatars/*'))
    for i, f in enumerate(images_list):
        if f.endswith('.jpg') or f.endswith('.jpeg') or f.endswith('.png'):
            img = cv2.imread(f)
            if img is None:
                log("Failed to open image: {}".format(f))
                continue

            if img.ndim == 2:
                img = np.tile(img[..., None], [1, 1, 3])
            img = img[..., :3][..., ::-1]
            img = resize(img, (IMG_SIZE, IMG_SIZE))
            avatars.append(img)
            filenames.append(f)
    return avatars, filenames


def change_avatar(predictor, new_avatar):
    avatar_kp = predictor.get_frame_kp(new_avatar)
    predictor.set_source_image(new_avatar)
    return avatar_kp


def kp_to_pixels(arr):
    '''Convert normalized landmark locations to screen pixels'''
    return ((arr + 1) * 127).astype(np.int32)


def fomm_load_predictor(avatarnum):
    print("torch.cuda.is_available:",torch.cuda.is_available(),torch.cuda.device_count())
    print('Loading Predictor')
    predictor_args = {
        'config_path': 'fomm/config/vox-adv-256.yaml',
        'checkpoint_path': 'vox-adv-cpk.pth.tar',
        'relative': True,
        'adapt_movement_scale': True,
        'enc_downscale': 1
    }
    avatars, avatar_names = load_images()
    predictor = predictor_local.PredictorLocal(**predictor_args)
    avatar_kp = change_avatar(predictor, avatars[avatarnum])
    return predictor, avatar_kp


def fomm_change_face(predictor, avatar_kp):
    is_debug = True
    last_x = 0
    last_y = 0
    last_w = 0
    last_h = 0
    skip_frame = 0
    is_detectface = False
    # init lock
    global lock
    if lock is None:
        lock = threading.Lock()
    # init windows
    if is_debug:
        cv2.namedWindow('cam', cv2.WINDOW_GUI_NORMAL)
        cv2.moveWindow('cam', 500, 250)
    # load cam
    cap = VideoCaptureAsync(0)
    cap.start()
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Can't receive frame (stream end?). Exiting ...")
            reak
        is_detectface = (skip_frame == 0) 
        out,last_x,last_y,last_w,last_h = fomm_change_frame(predictor, avatar_kp, frame,last_x,last_y,last_w,last_h,is_detectface)
        skip_frame = skip_frame + 1
        skip_frame = skip_frame % 10
        preview_frame = frame[..., ::-1].copy()
        if is_debug:
            key = cv2.waitKey(1)
            if key == ord('q'):
                break
            cv2.imshow('cam', preview_frame[..., ::-1])
            if out is not None:
                cv2.imshow('avatarify', out[..., ::-1])
    cap.stop
    cv2.destroyAllWindows()


def fomm_change_frame(predictor, avatar_kp, frame,last_x,last_y,last_w,last_h,is_detectface):
    IMG_SIZE = 256
    # init var
    avatar = None
    frame_proportion = 0.9
    frame_offset_x = 0
    frame_offset_y = 0
    find_keyframe = False
    is_calibrated = False
    # lock
    global lock
    if lock is None:
        lock = threading.Lock()
    try:
        frame = frame[..., ::-1]
        if last_x == 0 and last_y == 0 and last_w == 0 and last_h == 0 :
            is_detectface = True
        # detect faces
        if is_detectface :
            faces = detect_face(frame)
            if(len(faces) > 0):
                frame, last_x, last_y, last_w, last_h = crop_face(
                    frame, faces[0], last_x, last_y, last_w, last_h)
            else:
                frame = None
                return None,0,0,0,0
        else:
           faces = [(last_x, last_y, last_w, last_h)]
           frame, last_x, last_y, last_w, last_h = crop_face(
                frame, faces[0], last_x, last_y, last_w, last_h) 
        # resize face
        try:
            frame = resize(frame, (IMG_SIZE, IMG_SIZE))[..., :3]
        except Exception as e:
            last_x = 0
            last_y = 0
            last_w = 0
            last_h = 0
            return None,0,0,0,0
        # find key frame
        if find_keyframe:
            if is_new_frame_better(avatar, frame, predictor, avatar_kp):
                print("Taking new frame!")
                predictor.reset_frames()

        # change face
        lock.acquire()
        try:
            out = predictor.predict(frame)
        except Exception as e:
            print(e)
        finally:
            lock.release()
        if out is None:
            print('predict returned None')
        return out,last_x, last_y, last_w, last_h
    except Exception as e:
        print(e)
        return None,0,0,0,0

def fomm_test_predictor() :
    predictor, avatar_kp = fomm_load_predictor(1)
    fomm_change_face(predictor, avatar_kp)

if __name__ == "__main__":
    fomm_test_predictor()
