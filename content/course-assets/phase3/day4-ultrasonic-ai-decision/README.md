# Day 4 — Ultrasonic Sensing and Intelligent Decisions

## Goal

Students learn how an ultrasonic sensor can support intelligent decisions and screen-based feedback.

By the end of Day 4, students should be able to:

1. Use an ultrasonic ranging sensor to measure distance.
2. Convert raw distance readings into states such as `Near`, `Safe`, and `Far`.
3. Display distance and decision states on Serial Monitor or OLED.
4. Design simple intelligent decision rules based on distance.
5. Build an intelligent decision device.

## Labs

| Lab | Description |
| --- | --- |
| `01-ultrasonic-ranging` | Measure distance with an ultrasonic sensor |
| `02-distance-threshold-alert` | Classify distance using near/safe/far thresholds |
| `03-distance-oled-display` | Show distance and decision state on OLED |
| `04-environment-sensing-mini-project` | Build an intelligent distance-based decision device |

## Key concepts

- Ultrasonic ranging: send sound wave, wait for echo, calculate distance.
- Raw data: the number read from the sensor before interpretation.
- Threshold: a rule that turns numbers into states.
- Intelligent decision: use sensed data to choose a device response.
- Screen feedback: show the decision so users understand the system state.

## Suggested classroom flow

1. 25 min — Ultrasonic sensor principle and wiring.
2. 25 min — Read distance in Serial Monitor.
3. 30 min — Add threshold rules for near/safe/far.
4. 30 min — Display decision state on OLED.
5. 40 min — Intelligent decision device project.
6. 20 min — Reflection: what makes a device look intelligent?

## Example decision rules

```text
Distance < 20 cm  -> Too close / warning
20-100 cm         -> Safe
Distance > 100 cm -> Far / no target
```

## AI prompt examples

```text
Help me design distance-based decision rules for a safety reminder device.
```

```text
Improve this OLED display text so users can understand the distance warning clearly.
```

## Safety notes

- Check whether the ultrasonic module uses 3.3V or 5V.
- Some ECHO pins output 5V; use a voltage divider if your board is 3.3V-only.
- Connect all GND pins together.
- Keep wiring stable before collecting readings.
---

## 中文说明

第 4 天对应课程安排中的超声波传感器和智能决策装置。学生使用超声波测距，把距离数据转换成状态，并在 OLED 或串口中显示决策结果。

本日重点不是小车运动，而是“传感器数据如何驱动智能判断”。项目产出是智能决策装置。

学习重点：超声波测距、阈值判断、智能决策、屏幕反馈、AI 辅助规则设计。
