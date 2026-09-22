/**
 * The pile. Each entry pairs the character with the name Jev reasons about —
 * the model sees the name, never the glyph, so the name carries the meaning.
 *
 * Names are the plain thing a person would say ("paperclip", not "metal
 * fastener"): describing the object rather than its properties keeps the
 * questions honest, so a query like "things a magnet could attract" is
 * answered from world knowledge instead of from a word we planted.
 */
export type Emoji = {
  /** Stable key used for question IDs. */
  id: string;
  char: string;
  name: string;
};

export const EMOJI: Emoji[] = [
  // Clothing and wearables
  { id: 'ring', char: '💍', name: 'ring' },
  { id: 'headphones', char: '🎧', name: 'headphones' },
  { id: 'scarf', char: '🧣', name: 'scarf' },
  { id: 'gloves', char: '🧤', name: 'gloves' },
  { id: 'sunglasses', char: '🕶️', name: 'sunglasses' },
  { id: 'hiking_boot', char: '🥾', name: 'hiking boot' },
  { id: 'jeans', char: '👖', name: 'jeans' },
  { id: 'socks', char: '🧦', name: 'socks' },
  { id: 'top_hat', char: '🎩', name: 'top hat' },
  { id: 'crown', char: '👑', name: 'crown' },
  { id: 'necktie', char: '👔', name: 'necktie' },
  { id: 'watch', char: '⌚', name: 'wristwatch' },

  // Fresh food
  { id: 'apple', char: '🍎', name: 'apple' },
  { id: 'banana', char: '🍌', name: 'banana' },
  { id: 'strawberry', char: '🍓', name: 'strawberry' },
  { id: 'broccoli', char: '🥦', name: 'broccoli' },
  { id: 'avocado', char: '🥑', name: 'avocado' },
  { id: 'carrot', char: '🥕', name: 'carrot' },
  { id: 'lemon', char: '🍋', name: 'lemon' },
  { id: 'grapes', char: '🍇', name: 'grapes' },
  { id: 'hot_pepper', char: '🌶️', name: 'hot pepper' },
  { id: 'onion', char: '🧅', name: 'onion' },
  { id: 'mushroom', char: '🍄', name: 'mushroom' },
  { id: 'egg', char: '🥚', name: 'egg' },

  // Prepared and indulgent food
  { id: 'pizza', char: '🍕', name: 'pizza' },
  { id: 'donut', char: '🍩', name: 'donut' },
  { id: 'cookie', char: '🍪', name: 'cookie' },
  { id: 'croissant', char: '🥐', name: 'croissant' },
  { id: 'popcorn', char: '🍿', name: 'popcorn' },
  { id: 'cheese', char: '🧀', name: 'wedge of cheese' },
  { id: 'bacon', char: '🥓', name: 'bacon' },
  { id: 'cupcake', char: '🧁', name: 'cupcake' },
  { id: 'honey', char: '🍯', name: 'jar of honey' },
  { id: 'bowl', char: '🥣', name: 'bowl of cereal' },

  // Drinks
  { id: 'coffee', char: '☕', name: 'cup of coffee' },
  { id: 'teapot', char: '🫖', name: 'teapot' },
  { id: 'water_bottle', char: '🧴', name: 'plastic bottle' },
  { id: 'energy_drink', char: '🥫', name: 'canned drink' },

  // Tools and hardware
  { id: 'key', char: '🔑', name: 'key' },
  { id: 'hammer', char: '🔨', name: 'hammer' },
  { id: 'screwdriver', char: '🪛', name: 'screwdriver' },
  { id: 'wrench', char: '🔧', name: 'wrench' },
  { id: 'scissors', char: '✂️', name: 'scissors' },
  { id: 'paperclip', char: '📎', name: 'paperclip' },
  { id: 'safety_pin', char: '🧷', name: 'safety pin' },
  { id: 'padlock', char: '🔒', name: 'padlock' },
  { id: 'nut_and_bolt', char: '🔩', name: 'nut and bolt' },
  { id: 'compass', char: '🧭', name: 'compass' },
  { id: 'magnet', char: '🧲', name: 'magnet' },
  { id: 'flashlight', char: '🔦', name: 'flashlight' },
  { id: 'battery', char: '🔋', name: 'battery' },
  { id: 'light_bulb', char: '💡', name: 'light bulb' },
  { id: 'chains', char: '⛓️', name: 'metal chain' },
  { id: 'broom', char: '🧹', name: 'broom' },

  // Musical instruments
  { id: 'guitar', char: '🎸', name: 'electric guitar' },
  { id: 'violin', char: '🎻', name: 'violin' },
  { id: 'trumpet', char: '🎺', name: 'trumpet' },
  { id: 'drum', char: '🥁', name: 'drum' },
  { id: 'saxophone', char: '🎷', name: 'saxophone' },
  { id: 'piano', char: '🎹', name: 'piano keyboard' },

  // Sport and play
  { id: 'soccer_ball', char: '⚽', name: 'soccer ball' },
  { id: 'basketball', char: '🏀', name: 'basketball' },
  { id: 'tennis_ball', char: '🎾', name: 'tennis ball' },
  { id: 'kite', char: '🪁', name: 'kite' },
  { id: 'balloon', char: '🎈', name: 'balloon' },
  { id: 'game_controller', char: '🎮', name: 'game controller' },
  { id: 'dice', char: '🎲', name: 'dice' },
  { id: 'puzzle_piece', char: '🧩', name: 'jigsaw puzzle piece' },
  { id: 'teddy_bear', char: '🧸', name: 'teddy bear' },
  { id: 'yo_yo', char: '🪀', name: 'yo-yo' },

  // Household and personal
  { id: 'mirror', char: '🪞', name: 'hand mirror' },
  { id: 'candle', char: '🕯️', name: 'candle' },
  { id: 'soap', char: '🧼', name: 'bar of soap' },
  { id: 'sponge', char: '🧽', name: 'sponge' },
  { id: 'toothbrush', char: '🪥', name: 'toothbrush' },
  { id: 'basket', char: '🧺', name: 'woven basket' },
  { id: 'thread', char: '🧵', name: 'spool of thread' },
  { id: 'umbrella', char: '☂️', name: 'umbrella' },
  { id: 'books', char: '📚', name: 'stack of books' },
  { id: 'pencil', char: '✏️', name: 'pencil' },
  { id: 'envelope', char: '✉️', name: 'envelope' },
  { id: 'camera', char: '📷', name: 'camera' },
  { id: 'mobile_phone', char: '📱', name: 'mobile phone' },
  { id: 'backpack', char: '🎒', name: 'backpack' },
  { id: 'briefcase', char: '💼', name: 'briefcase' },

  // Nature and outdoors
  { id: 'rose', char: '🌹', name: 'rose' },
  { id: 'potted_plant', char: '🪴', name: 'potted plant' },
  { id: 'herb', char: '🌿', name: 'sprig of herbs' },
  { id: 'rock', char: '🪨', name: 'rock' },
  { id: 'shell', char: '🐚', name: 'seashell' },
  { id: 'feather', char: '🪶', name: 'feather' },
  { id: 'cactus', char: '🌵', name: 'cactus' },
  { id: 'moon', char: '🌑', name: 'the moon' },
  { id: 'gem', char: '💎', name: 'cut gemstone' },
  { id: 'snowflake', char: '❄️', name: 'snowflake' },

  // Odds and ends
  { id: 'crystal_ball', char: '🔮', name: 'crystal ball' },
  { id: 'trophy', char: '🏆', name: 'trophy' },
  { id: 'bell', char: '🔔', name: 'bell' },
  { id: 'magnifying_glass', char: '🔍', name: 'magnifying glass' },
  { id: 'clock', char: '⏰', name: 'alarm clock' },
  { id: 'coin', char: '🪙', name: 'coin' },
];
