import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { RED } from "../constants.js";

interface InputBoxProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  commands?: string;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  placeholder = "Send a message...",
  commands = "Commands: /conversations • /back • /exit",
}) => {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor={RED}
      paddingX={1}
      marginTop={1}
      flexDirection="column"
    >
      <Box>
        <Text dimColor>│ </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </Box>
      <Text dimColor>{commands}</Text>
    </Box>
  );
};
