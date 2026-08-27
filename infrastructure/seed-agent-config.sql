SET NAMES utf8mb4;

INSERT INTO agent_profiles (id, agent_key, name, provider, app_key_ref, status)
VALUES
  ('hiagent_phase1', 'phase1', 'Phase 1 学习伙伴', 'hiagent', 'HIAGENT_PHASE1_APP_KEY', 'ACTIVE'),
  ('hiagent_phase2', 'phase2', 'Phase 2 学习伙伴', 'hiagent', 'HIAGENT_PHASE2_APP_KEY', 'ACTIVE'),
  ('hiagent_phase3', 'phase3', 'Phase 3 学习伙伴', 'hiagent', 'HIAGENT_PHASE34_APP_KEY', 'ACTIVE'),
  ('hiagent_phase4', 'phase4', 'Phase 4 学习伙伴', 'hiagent', 'HIAGENT_PHASE34_APP_KEY', 'ACTIVE'),
  ('hiagent_phase5', 'phase5', 'Phase 5 学习伙伴', 'hiagent', 'HIAGENT_PHASE5_APP_KEY', 'ACTIVE')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  provider = VALUES(provider),
  app_key_ref = VALUES(app_key_ref),
  status = 'ACTIVE',
  updated_at = UTC_TIMESTAMP(3);

INSERT INTO agent_prompt_versions
  (id, agent_id, prompt_version, system_prompt, opening_message, output_format, status)
VALUES
  (
    '11111111-0000-4000-8000-000000000001',
    'hiagent_phase1',
    'f007-phase1-v1',
    '你是 Phase 1 国产人工智能技术基础的学习伙伴。面向学生，用清楚、鼓励、可执行的方式解释 AI 应用、智能体、模型评测、Prompt、ESP32 与云边协同相关问题。',
    '我会结合你当前进入的 Phase 1 课程陪你学习。遇到概念、操作步骤或报错，都可以直接问我。',
    'markdown',
    'ACTIVE'
  ),
  (
    '11111111-0000-4000-8000-000000000002',
    'hiagent_phase2',
    'f007-phase2-v1',
    '你是 Phase 2 新型硬件设计的学习伙伴。面向学生解释 3D 打印、AI 辅助参数优化、激光雕刻、CNC、CAM、Arduino 编程与制造流程问题。',
    '我会结合你当前进入的 Phase 2 课程陪你学习。遇到设计、制造或编程问题，都可以直接问我。',
    'markdown',
    'ACTIVE'
  ),
  (
    '11111111-0000-4000-8000-000000000003',
    'hiagent_phase3',
    'f007-phase3-v1',
    '你是 Phase 3 基础项目：环境感知的学习伙伴。面向学生解释多维传感器、摄像头识别、音频识别、Edge Impulse、嵌入式部署与感知设备调试问题。不要自称 Phase 4。',
    '我会结合你当前进入的 Phase 3 课程陪你学习。遇到传感器、识别、训练或部署问题，都可以直接问我。',
    'markdown',
    'ACTIVE'
  ),
  (
    '11111111-0000-4000-8000-000000000004',
    'hiagent_phase4',
    'f007-phase4-v1',
    '你是 Phase 4 进阶项目：触觉反馈集成的学习伙伴。面向学生解释触摸交互、多执行器控制、灯带/电机/舵机、蓝牙或 WiFi 联动控制、AI 决策联动与具身执行逻辑问题。不要自称 Phase 3。',
    '我会结合你当前进入的 Phase 4 课程陪你学习。遇到触觉反馈、执行器联动或小车控制问题，都可以直接问我。',
    'markdown',
    'ACTIVE'
  ),
  (
    '11111111-0000-4000-8000-000000000005',
    'hiagent_phase5',
    'f007-phase5-v1',
    '你是 Phase 5 创新项目：具身智能控制的学习伙伴。面向学生解释 M5Stack、AI Desk Companion Bot、传感器融合、多模态交互、云边协同、项目路演和综合调试问题。',
    '我会结合你当前进入的 Phase 5 项目陪你学习。遇到机器人组装、传感器融合、交互设计或路演准备问题，都可以直接问我。',
    'markdown',
    'ACTIVE'
  )
ON DUPLICATE KEY UPDATE
  prompt_version = VALUES(prompt_version),
  system_prompt = VALUES(system_prompt),
  opening_message = VALUES(opening_message),
  output_format = VALUES(output_format),
  status = 'ACTIVE',
  updated_at = UTC_TIMESTAMP(3);

INSERT INTO agent_course_bindings
  (id, course_id, module_id, stage_id, agent_id, prompt_version_id, knowledge_scope_id, priority, status)
VALUES
  ('22222222-0000-4000-8000-000000000001', NULL, NULL, 'phase1', 'hiagent_phase1', '11111111-0000-4000-8000-000000000001', 'phase1', 100, 'ACTIVE'),
  ('22222222-0000-4000-8000-000000000002', NULL, NULL, 'phase2', 'hiagent_phase2', '11111111-0000-4000-8000-000000000002', 'phase2', 100, 'ACTIVE'),
  ('22222222-0000-4000-8000-000000000003', NULL, NULL, 'phase3', 'hiagent_phase3', '11111111-0000-4000-8000-000000000003', 'phase3', 100, 'ACTIVE'),
  ('22222222-0000-4000-8000-000000000004', NULL, NULL, 'phase4', 'hiagent_phase4', '11111111-0000-4000-8000-000000000004', 'phase4', 100, 'ACTIVE'),
  ('22222222-0000-4000-8000-000000000005', NULL, NULL, 'phase5', 'hiagent_phase5', '11111111-0000-4000-8000-000000000005', 'phase5', 100, 'ACTIVE')
ON DUPLICATE KEY UPDATE
  course_id = VALUES(course_id),
  module_id = VALUES(module_id),
  stage_id = VALUES(stage_id),
  agent_id = VALUES(agent_id),
  prompt_version_id = VALUES(prompt_version_id),
  knowledge_scope_id = VALUES(knowledge_scope_id),
  priority = VALUES(priority),
  status = 'ACTIVE',
  updated_at = UTC_TIMESTAMP(3);
