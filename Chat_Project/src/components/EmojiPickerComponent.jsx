import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

export function EmojiPicker({ onSelect }) {
  return (
    <Picker
      data={data}
      onEmojiSelect={onSelect}
      theme="dark"
      emojiSize={22}
      emojiButtonSize={34}
      previewPosition="none"
    />
  );
}
