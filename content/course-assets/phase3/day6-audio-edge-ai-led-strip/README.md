# Day 6 — LED Strip, Microphone, and Edge Impulse Audio Recognition

## Goal

Students learn LED strip programming, microphone capture, and Edge AI audio recognition, then build voice-controlled lights.

By the end of Day 6, students should be able to:

1. Program an addressable LED strip or light output.
2. Read microphone or sound-level data.
3. Validate audio input through Serial Monitor.
4. Detect simple sound events such as claps.
5. Describe the Edge Impulse workflow for collecting audio, training a classifier, and deploying it to a board.
6. Build voice-controlled lights.

## Labs

| Lab | Description |
| --- | --- |
| `01-led-strip-basic` | Program simple LED strip colors and effects |
| `02-microphone-test` | Read microphone values and print them in Serial Monitor |
| `03-sound-level-detection` | Classify quiet, normal, and loud environments |
| `04-audio-perception-mini-project` | Build a sound-triggered light or audio perception application |
| `05-edge-impulse-audio-classifier` | Use Edge Impulse workflow for audio classification |

## Key concepts

- LED strip: multiple addressable LEDs controlled from one data pin.
- Microphone as a sensor: sound becomes electrical data.
- Audio validation: check whether captured sound data changes correctly.
- Event detection: identify a sudden change such as a clap.
- Voice command: an advanced form of audio perception.
- Edge AI: run a small audio model locally on the device.
- Edge Impulse: collect audio samples, train a classifier, and export an Arduino library.

## Suggested classroom flow

1. 25 min — LED strip programming and safety.
2. 25 min — Microphone module and privacy notes.
3. 30 min — Read and validate raw microphone values.
4. 30 min — Build sound-level or clap detection.
5. 40 min — Edge Impulse audio classification workflow.
6. 40 min — Voice-controlled lights project.

## Privacy notes

- Do not record or share private conversations.
- Use short test sounds such as claps, knocks, or simple words.
- Make clear whether the device stores audio. These beginner examples only read signal values and do not save recordings.

## Suggested hardware

- Seeed XIAO ESP32-S3 Sense built-in microphone, or an analog microphone module.
- Addressable LED strip, such as WS2812/NeoPixel, or LED module for simpler kits.
- Optional passive buzzer or OLED for feedback.
- USB cable.
---

## 中文说明

第 6 天对应课程安排中的 LED 灯带编程、麦克风采集验证、音频边缘 AI 训练和语音控制灯光。学生先学习灯带颜色和效果控制，再读取麦克风数据，最后使用规则或 Edge Impulse 音频分类结果控制灯光。

本日项目产出是语音控制灯光。基础版本可以用拍手或声音强度控制灯光，进阶版本可以使用 Edge Impulse 识别简单声音类别或语音指令。

学习重点：LED 灯带、麦克风、音频数据验证、声音事件、Edge Impulse 音频分类、语音控制灯光。
