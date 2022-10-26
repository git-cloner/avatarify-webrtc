import dlib
import cv2
import numpy as np
import time
import logging
import os
import ssl
import uuid
import urllib

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


def load_custom_avatar(avatar):
    if avatar.isdigit():
        return None
    url_request = "https://classnotfound.com.cn/aiit/avatar/" + avatar + ".jpg"
    fileName = "./avatars/temp/" + avatar + ".jpg"

    opener = urllib.request.build_opener()
    opener.addheaders = [
        ('Authorization', 'Basic YXZhdGFyOkF2YXRhckA3ODk0NTYxMjM=')]
    urllib.request.install_opener(opener)
    try:
        urllib.request.urlretrieve(url=url_request, filename=fileName)
        return fileName
    except Exception as e:
        return None
    urllib.request.urlcleanup()


def load_landmarks(avatar):
    global detector_face
    global predictor_face
    if avatar.isdigit():
        im1 = cv2.imread('./avatars/' + avatar + '.png')
    else:
        fileName = load_custom_avatar(avatar)
        if fileName is None:
            im1 = cv2.imread('./avatars/1.png')
        else:
            im1 = cv2.imread(fileName)
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