/**
 * GENERATED FILE - DO NOT EDIT BY HAND.
 *
 * Source: shared/design/tokens.json
 * Regenerate with: node shared/design/build-tokens.js
 */

import type {TextStyle} from 'react-native';

export const colors = {
  "green": {
    "100": "#DCE9DD",
    "200": "#B0CBA4",
    "300": "#96BC87",
    "500": "#54A96A",
    "600": "#3D8A52",
    "700": "#2E6F40",
    "800": "#1B4429",
    "900": "#12301D",
    "075": "#F1F6EF",
    "050": "#F4F8F3"
  },
  "gray": {
    "50": "#F8F9FA",
    "100": "#F0F4F8",
    "200": "#E5E5E5",
    "300": "#D0D0D0",
    "400": "#A0A0A0",
    "500": "#7A7A7A",
    "600": "#5E5E5E",
    "700": "#4A4A4A",
    "800": "#2B2B2B",
    "900": "#1A1A1A"
  },
  "amber": {
    "100": "#FFF3CD",
    "500": "#FFC107",
    "800": "#7A5C0A"
  },
  "red": {
    "600": "#DC3545",
    "800": "#842029"
  },
  "semantic": {
    "error": "#DC3545",
    "warning": "#FFC107",
    "info": "#0D6EFD",
    "success": "#198754"
  },
  "gradient": {
    "groundFrom": "#F8F9FA",
    "groundTo": "#F0F4F8"
  },
  "white": "#FFFFFF",
  "text": {
    "primary": "#1A1A1A",
    "secondary": "#4A4A4A",
    "muted": "#7A7A7A",
    "placeholder": "#A0A0A0",
    "onPrimary": "#FFFFFF",
    "link": "#2E6F40",
    "danger": "#842029"
  },
  "surface": {
    "page": "#F8F9FA",
    "card": "#FFFFFF",
    "subtle": "#F0F4F8",
    "selected": "#E8F5EA",
    "pressed": "#F0F4F8",
    "overlay": "rgba(26,26,26,0.35)"
  },
  "border": {
    "default": "#E5E5E5",
    "strong": "#D0D0D0",
    "focus": "#2E6F40",
    "selected": "#2E6F40",
    "danger": "#DC3545"
  },
  "primary": {
    "default": "#2E6F40",
    "pressed": "#1F5227",
    "soft": "#E8F5EA",
    "softStrong": "#DCE9DD",
    "onPrimary": "#FFFFFF"
  },
  "badge": {
    "yellowBg": "#FFF3CD",
    "yellowFg": "#7A5C0A",
    "greenBg": "#E8F5EA",
    "greenFg": "#1F5227",
    "redBg": "#FEE2E2",
    "redFg": "#991B1B",
    "grayBg": "#F3F4F6",
    "grayFg": "#374151",
    "blueBg": "#DBEAFE",
    "blueFg": "#1E40AF",
    "purpleBg": "#EDE9FE",
    "purpleFg": "#5B21B6"
  }
} as const;

export const shadows = {
  "sm": {
    "shadowColor": "#000000",
    "shadowOffset": {
      "width": 0,
      "height": 1
    },
    "shadowRadius": 1,
    "shadowOpacity": 0.05,
    "elevation": 1
  },
  "md": {
    "shadowColor": "#000000",
    "shadowOffset": {
      "width": 0,
      "height": 2
    },
    "shadowRadius": 2,
    "shadowOpacity": 0.08,
    "elevation": 2
  },
  "lg": {
    "shadowColor": "#000000",
    "shadowOffset": {
      "width": 0,
      "height": 4
    },
    "shadowRadius": 6,
    "shadowOpacity": 0.1,
    "elevation": 4
  }
} as const;

export const radius = {
  "xs": 6,
  "sm": 8,
  "md": 12,
  "lg": 16,
  "xl": 24,
  "pill": 999
} as const;

/** 8pt spacing grid. */
export const space = {
  "xs": 4,
  "sm": 8,
  "md": 12,
  "lg": 16,
  "xl": 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48
} as const;

export const typography = {
  "fontFamily": {
    "sans": "Open Sans",
    "fallback": "system-ui, -apple-system, sans-serif"
  },
  "weight": {
    "regular": 400,
    "medium": 500,
    "semibold": 600,
    "bold": 700,
    "extrabold": 800
  },
  "role": {
    "display": {
      "size": 34,
      "weight": 800,
      "lineHeight": 1.16,
      "letterSpacing": -0.02
    },
    "title": {
      "size": 28,
      "weight": 800,
      "lineHeight": 1.2,
      "letterSpacing": -0.02
    },
    "heading": {
      "size": 22,
      "weight": 700,
      "lineHeight": 1.25,
      "letterSpacing": -0.01
    },
    "subheading": {
      "size": 18,
      "weight": 700,
      "lineHeight": 1.3,
      "letterSpacing": -0.01
    },
    "cardTitle": {
      "size": 16,
      "weight": 700,
      "lineHeight": 1.35,
      "letterSpacing": -0.01
    },
    "input": {
      "size": 16,
      "weight": 500,
      "lineHeight": 1.4,
      "letterSpacing": 0
    },
    "body": {
      "size": 15,
      "weight": 400,
      "lineHeight": 1.55,
      "letterSpacing": 0
    },
    "bodyStrong": {
      "size": 15,
      "weight": 600,
      "lineHeight": 1.5,
      "letterSpacing": 0
    },
    "bodySm": {
      "size": 14,
      "weight": 500,
      "lineHeight": 1.5,
      "letterSpacing": 0
    },
    "meta": {
      "size": 13,
      "weight": 600,
      "lineHeight": 1.45,
      "letterSpacing": 0
    },
    "caption": {
      "size": 12,
      "weight": 600,
      "lineHeight": 1.5,
      "letterSpacing": 0
    },
    "badge": {
      "size": 11.5,
      "weight": 700,
      "lineHeight": 1.3,
      "letterSpacing": 0
    },
    "eyebrow": {
      "size": 11.5,
      "weight": 700,
      "lineHeight": 1.3,
      "letterSpacing": 0.08,
      "textTransform": "uppercase"
    }
  }
} as const;

/** Hard minimums from the field constraints - these outrank aesthetics. */
export const size = {
  "minTouchTarget": 48,
  "inputMinHeight": 50,
  "buttonMinHeight": 52,
  "buttonMinHeightSm": 44,
  "chipMinHeight": 40,
  "iconButton": 44,
  "avatar": 44,
  "screenPaddingX": 16
} as const;

export const motion = {
  "pressOpacity": 0.72,
  "fast": 120,
  "normal": 220
} as const;

export type TypographyRole = keyof typeof typography.role;

const FONT_FILES: Record<number, string> = {
  400: 'OpenSans-Regular',
  500: 'OpenSans-Medium',
  600: 'OpenSans-SemiBold',
  700: 'OpenSans-Bold',
  800: 'OpenSans-ExtraBold',
};

/** Text style for a typography role. Open Sans is bundled - never fetched at runtime. */
export function text(role: TypographyRole, color: string = colors.text.primary): TextStyle {
  const r = typography.role[role];
  const style: TextStyle = {
    fontFamily: FONT_FILES[r.weight] ?? typography.fontFamily.sans,
    fontSize: r.size,
    fontWeight: String(r.weight) as TextStyle['fontWeight'],
    lineHeight: Math.round(r.size * r.lineHeight),
    letterSpacing: r.letterSpacing * r.size,
    color,
  };
  if ('textTransform' in r) {
    style.textTransform = (r as {textTransform: string}).textTransform as TextStyle['textTransform'];
  }
  return style;
}

export const theme = {
  colors,
  shadows,
  radius,
  space,
  typography,
  size,
  motion,
  text,
} as const;

export default theme;
