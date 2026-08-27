# 源码与资源来源 / Source and asset provenance

## 中文

Community 候选版本由内部开发基线进行范围化导出。用于溯源的源提交指纹为：

```text
d3e3d454f21991bb3e45d45c4dc628daa1d705ba
```

Community 仓库使用全新 Git 历史，不继承内部开发历史。这一选择用于建立清晰的开源边界，并避免将无关产物、运维信息或历史配置带入公开版本。

未纳入 Community 候选版本的内容包括：

- 生产服务器地址、SSH 命令与服务器文件系统路径；
- 生产配置、凭据、数据库、备份与真实用户数据；
- 内部交接、审计与运维文档；
- 与 Personalized Learning Community 运行无关的展示站、实验站与独立应用；
- 由外部作者发布的 Text2CAD 论文 PDF。

Text2CAD 论文可通过 [NeurIPS 官方论文页面](https://proceedings.neurips.cc/paper_files/paper/2024/hash/0e5b96f97c1813bb75f6c28532c2ecc7-Abstract-Conference.html) 访问。Community 仓库链接官方发布页，不重新分发该 PDF。

`content/course-assets/phase1` 至 `phase4` 中保留了各自的许可证文件。新增课程或媒体资源必须按 [CONTRIBUTING.md](../CONTRIBUTING.md) 提供来源、授权与必要署名。

## English

The Community candidate was produced as a scoped export from an internal development baseline. Its source commit fingerprint is:

```text
d3e3d454f21991bb3e45d45c4dc628daa1d705ba
```

The Community repository starts a new Git history and does not inherit the internal development history. This establishes a clear open-source boundary and avoids carrying unrelated artifacts, operational information, or historical configuration into the public edition.

The candidate excludes:

- production server addresses, SSH commands, and server filesystem paths;
- production configuration, credentials, databases, backups, and real user data;
- internal handoff, audit, and operations documents;
- landing sites, laboratories, and standalone applications unrelated to the Personalized Learning Community runtime;
- the externally authored Text2CAD paper PDF.

The Text2CAD paper remains available from the [official NeurIPS proceedings](https://proceedings.neurips.cc/paper_files/paper/2024/hash/0e5b96f97c1813bb75f6c28532c2ecc7-Abstract-Conference.html). The Community repository links to the official publication instead of redistributing the PDF.

Licence files are retained under `content/course-assets/phase1` through `phase4`. Every new course or media asset must include source, permission, and attribution information as described in [CONTRIBUTING.md](../CONTRIBUTING.md).
