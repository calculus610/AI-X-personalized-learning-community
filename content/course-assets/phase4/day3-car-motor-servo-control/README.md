# Day 3 — Car Motor and Servo Control

## Goal

Students learn DC motor, motor driver, servo control, and basic car motion programming.

By the end of Day 3, students should be able to:

1. Explain why motors need a driver module.
2. Test one DC motor safely.
3. Control two motors as a car chassis.
4. Control servo angle.
5. Build a car motion program with forward, backward, left, right, and stop actions.

## Labs

| Lab | Description |
| --- | --- |
| `01-single-motor-test` | Drive one DC motor through TB6612 and observe direction and speed |
| `02-dual-motor-actions` | Build forward, backward, left, right, and stop functions on two motors |
| `03-servo-control` | Sweep an SG90 and compare 180-degree and 360-degree behavior |
| `04-car-motion-program` | Combine motors and servo into a complete car motion program |

## Key concepts

- DC motor: continuous rotation for wheels.
- Motor driver: required because GPIO pins cannot power motors directly.
- PWM: controls motor speed.
- Servo: controlled angle movement.
- Motion function: reusable action such as `forward()` or `turnLeft()`.

## Suggested classroom flow

1. 25 min — DC motor, servo, and motor driver introduction.
2. 30 min — Motor safety and single/dual motor test.
3. 30 min — Servo angle control.
4. 45 min — Car motion program.
5. 20 min — Debugging motor direction and speed.

## Safety notes

- Do not power motors directly from GPIO pins.
- Use a motor driver module such as TB6612 or L298N.
- Keep wheels lifted during first tests.
- Connect all GND pins together.
---

## 中文说明

第 3 天对应课程安排中的小车电机和舵机控制。学生学习直流电机、电机驱动板、PWM 速度控制和舵机角度控制，最终完成小车运动程序。

项目产出是小车运动程序，包括前进、后退、左转、右转和停止。
