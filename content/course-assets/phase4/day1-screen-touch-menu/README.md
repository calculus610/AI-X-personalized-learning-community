# Day 1 — Screen Layout and Touch Menu Control

## Goal

Students learn screen layout design and touch menu control. The course schedule notes that the kit screen may not include touch, so a separate touchscreen module is required for real touch feedback.

By the end of Day 1, students should be able to:

1. Design a simple screen layout.
2. Understand touch feedback and menu interaction.
3. Read button, touch sensor, or touchscreen input.
4. Use short press, long press, or touch areas to change menu state.
5. Use AI to improve screen layout and interaction flow.

## Labs

| Lab | Description |
| --- | --- |
| `01-button-input` | Read a button and control a state |
| `02-touch-toggle` | Use touch input to toggle a state |
| `03-short-long-press` | Detect short press and long press actions |

## Key concepts

- Screen layout: organize text, icons, buttons, and states clearly.
- Touch feedback: show users that their action was received.
- Menu state: a screen can have multiple pages or modes.
- Alternative input: if no touchscreen is available, use buttons to simulate menu control.
- AI-assisted layout: ask AI to suggest cleaner labels, menu structure, and feedback messages.

## AI prompt examples

```text
Design a simple touchscreen menu for three modes: Manual, Auto, and Settings.
```

```text
Improve this OLED menu layout so students can understand the current mode clearly.
```

## Suggested classroom flow

1. 20 min — Screen layout and touch menu examples.
2. 25 min — Button input as menu control fallback.
3. 30 min — Touch input or touch sensor toggle.
4. 30 min — Short press / long press for menu actions.
5. 35 min — AI-assisted touch menu control project.

## Hardware note

The kit screen may not support touch. Use a separate touchscreen module for real touch input. If it is not available, use a button, touch sensor, or Serial command to simulate menu control.
---

## 中文说明

第 1 天对应课程安排中的屏幕布局和触摸反馈。需要注意：套件屏幕本身可能不带触摸功能，如需完成真实触摸菜单，需要单独触摸屏模块。

如果没有触摸屏，可以使用按钮、触摸传感器或串口命令模拟菜单交互。本日项目产出是触摸菜单控制原型。
