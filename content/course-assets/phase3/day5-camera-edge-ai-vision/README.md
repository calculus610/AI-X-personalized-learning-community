# Day 5 — Camera Vision, CNN Basics, and Edge Impulse Image Recognition

## Goal

Students learn how a smart hardware device can use a camera to see the environment, then extend simple visual rules into Edge AI image recognition with Edge Impulse.

By the end of Day 5, students should be able to:

1. Explain how a camera becomes an environmental sensor.
2. Initialize a camera module and capture a frame.
3. Understand that an image is made of pixels and color values.
4. Explain the basic idea of CNN image classification.
5. Describe the Edge Impulse workflow for collecting images, training a classifier, and deploying it to a board.
6. Build a simple gesture recognition system or visual classifier.

## Labs

| Lab | Description |
| --- | --- |
| `01-camera-first-capture` | Initialize the camera and capture the first frame |
| `02-image-data-and-pixels` | Read basic image information and connect images with pixel data |
| `03-color-detection` | Detect a simple color target or visual state |
| `04-visual-perception-mini-project` | Build a small visual perception or gesture recognition prototype |
| `05-edge-impulse-vision-classifier` | Use Edge Impulse workflow for image classification |

## Key concepts

- Camera as a sensor: image input is environmental data.
- Image frame: one captured picture from the camera.
- Pixel: a small unit of an image.
- Brightness and color: simple features that can be detected without complex AI.
- CNN: a neural network structure commonly used for image classification.
- Edge AI: run a small model locally on the device.
- Edge Impulse: collect image data, train a classifier, and export an Arduino library.

## Suggested classroom flow

1. 20 min — What visual perception means in smart hardware.
2. 30 min — Camera module introduction and privacy notes.
3. 35 min — Capture the first image frame and view camera data.
4. 25 min — CNN basics and image classification concept.
5. 35 min — Color/gesture visual-state detection.
6. 40 min — Edge Impulse image classification workflow.
7. 25 min — Gesture recognition system project.

## Network viewing note

If the selected camera board supports a web camera example, students can view the camera image from a browser on the same network. Keep Wi-Fi passwords out of the repository.

## Privacy notes

- Do not take photos of people without permission.
- Do not upload classroom photos to public websites.
- Delete test images if they contain private information.
- For teaching, use colored cards, hand gestures, objects, or printed patterns instead of faces.

## Suggested hardware

- Seeed XIAO ESP32-S3 Sense, or another ESP32-S3 board with camera.
- USB cable.
- Optional: OLED display for showing visual status.
- Colored cards, hand gestures, or simple objects for detection tests.
---

## 中文说明

第 5 天对应课程安排中的摄像头采集、网络查看、CNN 基础、图片边缘 AI 训练和本地图像识别。学生使用摄像头获取图像，理解图像帧、像素、亮度和颜色等基本概念，并进一步了解 Edge Impulse 图像分类流程。

本日项目产出是手势识别系统或简单视觉分类器。建议使用 Seeed XIAO ESP32-S3 Sense 或其他带摄像头的 ESP32-S3 开发板。

学习重点：摄像头、图像帧、像素、CNN 基础、Edge Impulse 图像分类、本地推理、隐私与伦理。
