# Number multiplier agent

This agent listens for number messages, multiplies them by 2, and creates a group with the original sender and address `0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204` to share the result.

## Setup

1. Generate XMTP keys:

```bash
yarn gen:keys
```

2. Start the agent:

```bash
yarn start
```

## Usage

Send a number to the agent, and it will:

1. Multiply the number by 2
2. Create a new group with you and `0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204`
3. Share the result in the group

## Example

1. Send message: `10`
2. Agent creates group "Number Multiplier: 20" with you and the configured address
3. Agent sends the multiplication result in the group
