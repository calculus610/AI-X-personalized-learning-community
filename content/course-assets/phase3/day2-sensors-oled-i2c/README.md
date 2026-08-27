# Day 2 — Sensor Communication, OLED, and AI-Assisted Interface Design

## Goal

Students learn sensor communication, screen display, and simple AI-assisted interface design.

By the end of Day 2, students should be able to:

1. Understand what sensors do.
2. Learn basic I2C communication concepts.
3. Use an I2C scanner to find device addresses.
4. Read temperature and humidity from a DHT11 sensor.
5. Display information on an OLED screen.
6. Use AI to improve screen layout and component function design.
7. Build a multi-interface badge or thermometer/hygrometer.

## Labs

| Lab | Description |
| --- | --- |
| `01-i2c-scanner` | Find connected I2C device addresses |
| `02-dht11-serial` | Read DHT11 temperature/humidity in Serial Monitor |
| `03-oled-hello` | Display text on OLED |
| `04-dht11-oled` | Show DHT11 data on OLED |
| `05-multi-interface-badge` | Build a screen-based badge or thermometer/hygrometer prototype |

## Key concepts

- Sensor: converts the physical world into data.
- OLED: displays data without needing a computer screen.
- I2C: communication bus using SDA and SCL lines.
- I2C address: each device has an address, often `0x3C` for OLED.
- Library: reusable code package that simplifies hardware control.
- Interface design: screen layout should make data easy to read.
- AI-assisted design: use AI to suggest labels, layout, icons, and display logic.

## Suggested libraries

Install from Arduino Library Manager:

- `DHT sensor library`
- `Adafruit Unified Sensor`
- `Adafruit SSD1306`
- `Adafruit GFX Library`

## AI prompt examples

```text
Design a clear OLED layout for temperature, humidity, and comfort advice.
```

```text
Help me add a button-controlled page switch to this OLED display project.
```

## Suggested classroom flow

1. 20 min — Sensors and I2C introduction.
2. 20 min — I2C scanner lab.
3. 30 min — DHT11 serial lab.
4. 30 min — OLED display lab.
5. 35 min — DHT11 + OLED integrated project.
6. 25 min — AI-assisted screen/interface improvement.
---

## 中文说明

第 2 天对应课程安排中的传感器通信、按钮和屏幕内容。学生先理解传感器如何把真实世界转换成数据，再通过 DHT11 读取温湿度，通过 I2C OLED 显示文字和数值，最后完成多接口徽章或温湿度计。

本日加入 AI 辅助界面设计：学生可以让 AI 帮助设计 OLED 布局、提示语、页面切换逻辑或组件功能。

学习重点：传感器数据读取、I2C 地址、SDA/SCL 接线、库函数使用、屏幕显示、AI 辅助界面设计。
