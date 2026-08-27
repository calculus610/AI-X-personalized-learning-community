# Day 3 — Edge AI Fundamentals and Sensor Data Fusion

## Goal

Students learn basic AI and Edge AI concepts, then use multi-sensor data to build an environmental monitoring device.

By the end of Day 3, students should be able to:

1. Explain the difference between rule-based decisions and AI decisions.
2. Explain why Edge AI runs locally on the device.
3. Read multiple sensor values in one program.
4. Convert raw values into normalized states or scores.
5. Combine sensor data using rules, weighted scores, or Edge Impulse-style classification.
6. Build an environmental monitoring device.

## Labs

| Lab | Description |
| --- | --- |
| `01-multi-sensor-read` | Read multiple sensors in one program |
| `02-data-normalization-and-display` | Convert raw values into comparable scores and display them |
| `03-rule-based-fusion` | Combine several sensor states into one decision |
| `04-sensor-fusion-project` | Build an environmental monitoring device |
| `05-edge-impulse-fusion-classifier` | Use Edge Impulse workflow for sensor-fusion classification |

## Key concepts

- AI decision: classify or predict based on data.
- Edge AI: run AI inference locally on the board or device.
- Sensor fusion: combine multiple sensor readings to improve understanding.
- Data fusion: combine data from different sources into one result.
- Normalization: convert different value ranges into comparable scores.
- Rule-based fusion: use `if` rules to combine conditions.
- Weighted score: give each sensor a different importance.
- Edge Impulse: train a classifier from sensor features and deploy it to Arduino.

## Suggested classroom flow

1. 20 min — AI basics and Edge AI examples.
2. 25 min — Read multiple sensors together.
3. 30 min — Normalize data into scores.
4. 30 min — Rule-based and weighted fusion.
5. 40 min — Edge Impulse sensor-fusion workflow.
6. 35 min — Environmental monitoring device project.

## Example project output

```text
Temp: 27.0 C
Humidity: 63 %
Sound: 180
Distance: 45 cm
Status: Warning
```

## AI prompt examples

```text
Help me design sensor fusion rules for temperature, humidity, distance, and sound.
```

```text
Suggest labels for an Edge Impulse environmental monitoring classifier.
```

## Project levels

| Level | Requirement | Who should do it |
| --- | --- | --- |
| Basic | Read at least two sensors and show their states | Everyone |
| Standard | Combine at least three inputs into one decision | Most teams |
| Advanced | Use weighted score or Edge Impulse classifier workflow | Faster teams |
| Extension | Compare rule-based fusion and Edge AI classification | Optional project extension |
---

## 中文说明

第 3 天对应课程安排中的 AI 基础与边缘 AI 传感器融合。学生将理解规则判断和 AI 判断的区别，学习为什么边缘 AI 可以在设备本地进行推理，并把多个传感器数据融合成环境状态。

本日项目产出是环境监测装置。基础版本可以使用规则融合，进阶版本可以使用 Edge Impulse 训练传感器特征分类器。

学习重点：AI 基础、边缘 AI、传感器融合、数据归一化、规则融合、加权评分、Edge Impulse。
