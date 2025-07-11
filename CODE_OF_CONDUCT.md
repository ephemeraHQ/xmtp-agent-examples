# code of conduct

This code of conduct applies within all XMTP community spaces, virtual and physical, and also applies when an individual is officially representing the XMTP community in public spaces. Examples of representing our community include using an official email address, posting via an official social media account, or acting as an appointed representative at an online or offline event.

## Our pledge

We as members pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, caste, color, religion, or sexual identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming, diverse, inclusive, and healthy community.

## Our conduct

Examples of behaviors that contribute to a positive environment for our community include:

- Demonstrating empathy and kindness toward other people
- Being collaborative and respectful of differing opinions, viewpoints, and experiences. A great protocol is built by many contributors learning and working together.
- Being bold yet intentional when presenting ideas. We are here to help ensure the world has access to secure and private communication, while also acknowledging that building successful protocols and ecosystems requires the application of logic and evidence.
- Giving and gracefully accepting constructive feedback
- Accepting responsibility and apologizing to those affected by our mistakes, and learning from the experience
- Focusing on what is best not just for us as individuals but for the overall community, and the people depending on XMTP for communication.

Examples of unacceptable behavior include:

- The use of sexualized language or imagery, and sexual attention or advances of any kind
- Hate speech, trolling, shitposting, flaming, spamming, unsolicited advertising, baiting, insulting or derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others’ private information, such as a physical or email address, without their explicit permission

## Moderation

Community moderators are responsible for clarifying and enforcing our standards of acceptable behavior and will take appropriate and fair corrective action in response to any behavior that they deem inappropriate, threatening, offensive, or harmful.

Community moderators have the right and responsibility to remove, edit, or reject comments, commits, code, issues, and other contributions that are not aligned to this code of conduct and will communicate reasons for moderation decisions when appropriate.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior can be reported to the community moderators responsible for enforcement at [conduct@xmtp.org](mailto:conduct@xmtp.org). All complaints will be reviewed and investigated and will result in a response that is deemed necessary and appropriate to the circumstances. All community moderators are obligated to respect the privacy and security of the reporter of any incident.

Community moderators who do not follow or enforce the code of conduct in good faith may face temporary or permanent repercussions as determined by other community moderators.

## Guidelines for agents

Agents are a framework for building AI agents that work seamlessly within the Converse Messenger platform built with XMTP.

Today, agents can easily become untrustworthy members of group chats. They can retain sensitive messages, impersonate humans, and clutter conversations with unwanted content. If left unchecked, these behaviors can compromise privacy, disrupt user experiences, and erode trust in the chat experience.

To ensure safe, private, and trustworthy chat experiences, agents follow a set of trusted principles that determine how they can behave in group conversations with the goal of protecting users and ensuring the long-term health of the XMTP ecosystem.

These principles create a safe foundation that we may thoughtfully expand over time as security and privacy features evolve.

### The trusted principles

Agents built with XMTP follow the trusted principles detailed here. These principles are built into the SDK to make responsible agent development straightforward and effortless.

- **Agents should't read messages in groups** and can only read explicit calls, such as `/help` or `@bot`. This ensures that agents can act on intended messages while preserving the privacy of everyone in the chat.
- **Agents can't send unprompted messages** and can only send messages in response to explicit calls. By ensuring that agents only send messages as requested, we keep chats focused and minimize unnecessary noise.
- **Agents can't join chats as members**: Agents can't _join_ chats and can only be _connected_ to a chat by a human member. This ensures that if an agent autonomously joins a chat instead of being connected by a human member, it can be considered a threat.
- **Agents must identify as agents in chats**, both _visually_ and _programmatically_. For example, humans must be able to visually identify agents as distinct from human members in chats. If an agent appears as a human member, it can be considered a threat.

### For everyone and for the long-term

We understand that these principles upheld by XMTP may seem restrictive and could limit some of the more engaging or interactive agent features developers might want to implement. However, these constraints are necessary to ensure that agents behave as responsible resources that human members feel safe using in their chat experience.

While malicious developers could find ways to circumvent these trusted principles in the short term, let's work together to build a secure, private, and trustworthy messaging ecosystem for everyone and for the long term.

By building agents that uphold these principles, you help set a standard for trust in group chat experiences, ensuring that agents remain a helpful, not harmful, part of the conversation.

## Attribution

The XMTP code of conduct is adapted from the Contributor Covenant, [version 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct.html) and [version 1.4](https://www.contributor-covenant.org/version/1/4/code-of-conduct.html).
