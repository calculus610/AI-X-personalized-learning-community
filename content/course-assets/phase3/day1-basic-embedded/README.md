# Day 1 — Basic Electronics Hardware Intro

## Goal

Students learn the basic workflow of embedded hardware development and use AI to modify simple example code.

By the end of Day 1, students should be able to:

1. Install and configure Arduino IDE.
2. Select the correct ESP32 / ESP32-S3 board and serial port.
3. Upload the first program.
4. Use GPIO to control an LED.
5. Read a button input.
6. Create a blinking or breathing LED effect.
7. Use AI prompts to modify simple lighting code.

## Labs

| Lab | Description |
| --- | --- |
| `01-led-on` | Light an LED using digital output |
| `02-led-blink` | Blink an LED using `delay()` |
| `03-button-led` | Read a button and control LED state |
| `04-breathing-led` | Use PWM to create a breathing LED effect |

## Key concepts

- `setup()` runs once when the board starts.
- `loop()` runs repeatedly.
- `pinMode()` configures a pin as input or output.
- `digitalWrite()` outputs HIGH or LOW.
- `digitalRead()` reads button/sensor state.
- PWM changes brightness by rapidly switching output.
- AI-assisted coding can help students modify delay, brightness, and interaction rules.

## AI prompt examples

```text
Help me change this LED blink code into a breathing LED effect.
```

```text
Modify this button LED code so one press changes to the next lighting mode.
```

## Suggested classroom flow

1. 20 min — Arduino IDE setup and board connection.
2. 20 min — LED ON demo.
3. 25 min — Blink LED exercise.
4. 30 min — Button LED exercise.
5. 25 min — Breathing LED / lighting effect variation.
6. 20 min — Use AI to modify code and explain the change.
---

## 中文说明

第 1 天对应课程安排中的电子硬件入门。学生需要完成 Arduino IDE 环境搭建，理解 `setup()` 和 `loop()` 的作用，并通过 LED 点亮、LED 闪烁、按键控制 LED、呼吸灯四个实验掌握最基本的 GPIO 输入输出和 PWM 控制。

本日加入 AI 辅助代码修改：学生可以让 AI 帮助修改闪烁频率、灯光模式或按键交互规则，但需要自己理解和解释代码变化。

学习重点：开发板选择、串口选择、上传程序、数字输出、数字输入、PWM、呼吸灯、AI 辅助代码修改。
