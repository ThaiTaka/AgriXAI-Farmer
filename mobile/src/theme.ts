/**
 * GENERATED FILE - DO NOT EDIT BY HAND.
 *
 * Source: shared/design/tokens.json (extracted from "AgriXAI Farmer v4 - Standalone (1).html")
 * Regenerate with: node shared/design/build-tokens.js
 */

import type {TextStyle, ViewStyle} from 'react-native';

export const colors = {
  "green": {
    "100": "#DCE9DD",
    "150": "#C9DCC0",
    "200": "#B0CBA4",
    "300": "#96BC87",
    "400": "#5A8B44",
    "500": "#54A96A",
    "700": "#2E6F40",
    "750": "#1F4E2C",
    "800": "#1B4429",
    "850": "#122E1D",
    "900": "#12301D",
    "075": "#F1F6EF",
    "050": "#EEF2EC"
  },
  "lime": {
    "200": "#E6EBD3",
    "500": "#C3D24A",
    "800": "#4A5810",
    "900": "#12240F"
  },
  "amber": {
    "100": "#FBEDD2",
    "300": "#E5AC3D",
    "500": "#F2A104",
    "700": "#7A4F00",
    "800": "#5C4405",
    "900": "#3D2400"
  },
  "danger": {
    "bg": "#C24A12",
    "fg": "#FFF3E8",
    "dot": "#E4661F"
  },
  "neutral": {
    "white": "#FFFFFF",
    "photoBackdrop": "#081711",
    "iconDeep": "#0C2418"
  },
  "text": {
    "primary": "#12301D",
    "secondary": "#4B5F51",
    "webBody": "#42564A",
    "muted": "#6E8175",
    "eyebrow": "#7B8C7F",
    "onPrimary": "#FFFFFF",
    "alpha": {
      "55": "rgba(18,48,29,0.55)",
      "60": "rgba(18,48,29,0.60)",
      "62": "rgba(18,48,29,0.62)",
      "68": "rgba(18,48,29,0.68)",
      "70": "rgba(18,48,29,0.70)",
      "72": "rgba(18,48,29,0.72)",
      "74": "rgba(18,48,29,0.74)",
      "88": "rgba(18,48,29,0.88)",
      "deep86": "rgba(23,58,36,0.86)",
      "deep78": "rgba(23,58,36,0.78)",
      "deep70": "rgba(23,58,36,0.70)"
    }
  },
  "border": {
    "soft": "#E2E8E2",
    "webCard": "#D3DBD4",
    "webChip": "#CFD8CF",
    "glass": "rgba(255,255,255,0.62)",
    "glassStrong": "rgba(255,255,255,0.72)",
    "glassDashed": "rgba(255,255,255,0.94)",
    "amberSoft": "rgba(242,161,4,0.34)",
    "limeSoft": "rgba(195,210,74,0.22)",
    "greenSoft": "rgba(46,111,64,0.34)"
  },
  "track": "rgba(23,58,36,0.10)"
} as const;

export const gradients = {
  "appBackground": {
    "colors": [
      "#C9DCC0",
      "#B0CBA4",
      "#96BC87"
    ],
    "css": "linear-gradient(168deg,#C9DCC0 0%,#B0CBA4 52%,#96BC87 100%)",
    "locations": [
      0,
      0.52,
      1
    ]
  },
  "primaryAction": {
    "colors": [
      "#54A96A",
      "#2E6F40"
    ],
    "css": "linear-gradient(135deg,#54A96A,#2E6F40)",
    "locations": [
      0,
      1
    ]
  },
  "primaryActionTranslucent": {
    "colors": [
      "rgba(84,169,106,.9)",
      "rgba(46,111,64,.86)"
    ],
    "css": "linear-gradient(135deg,rgba(84,169,106,.9),rgba(46,111,64,.86))"
  },
  "progress": {
    "colors": [
      "#C3D24A",
      "#54A96A"
    ],
    "css": "linear-gradient(90deg,#C3D24A,#54A96A)"
  },
  "resultHighlight": {
    "colors": [
      "rgba(216,236,208,0.86)",
      "rgba(178,213,164,0.5)"
    ],
    "css": "linear-gradient(165deg,rgba(216,236,208,0.86) 0%,rgba(178,213,164,0.5) 100%)"
  },
  "loginScrim": {
    "colors": [
      "rgba(190,212,178,.92)",
      "rgba(190,212,178,.86)",
      "rgba(190,212,178,.5)",
      "rgba(190,212,178,.94)"
    ],
    "css": "linear-gradient(180deg,rgba(190,212,178,.92) 0%,rgba(190,212,178,.86) 30%,rgba(190,212,178,.5) 56%,rgba(190,212,178,.94) 100%)"
  },
  "homeScrim": {
    "colors": [
      "rgba(190,212,178,.9)",
      "rgba(190,212,178,.72)",
      "rgba(190,212,178,.44)",
      "rgba(190,212,178,.84)"
    ],
    "css": "linear-gradient(180deg,rgba(190,212,178,.9) 0%,rgba(190,212,178,.72) 26%,rgba(190,212,178,.44) 52%,rgba(190,212,178,.84) 100%)"
  }
} as const;

export const halo = {
  "$note": "Three fixed blurred radial glows behind the glass layer — they give backdrop-filter something to blur. Render behind all screen content, pointerEvents none.",
  "green": {
    "top": -90,
    "left": -70,
    "size": 300,
    "blur": 26,
    "css": "radial-gradient(circle,rgba(84,169,106,.34) 0%,rgba(84,169,106,0) 70%)"
  },
  "lime": {
    "top": 210,
    "right": -110,
    "size": 290,
    "blur": 30,
    "css": "radial-gradient(circle,rgba(195,210,74,.3) 0%,rgba(195,210,74,0) 70%)"
  },
  "amber": {
    "bottom": -70,
    "left": 20,
    "size": 280,
    "blur": 34,
    "css": "radial-gradient(circle,rgba(242,161,4,.22) 0%,rgba(242,161,4,0) 70%)"
  }
} as const;

/**
 * Liquid-glass surfaces.
 *
 * React Native has no `backdrop-filter`. Each level therefore ships both:
 *   - `gradientColors` for <LinearGradient> (+ an optional <BlurView> behind), and
 *   - `solidBackground`, the opaque fallback required by the field constraints
 *     (weak devices, or when the farmer turns on "Che do ngoai nang").
 * Pick between them with `surface(level, solid)`.
 */
export const glass = {
  "strong": {
    "gradientColors": [
      "rgba(255,255,255,0.82)",
      "rgba(255,255,255,0.43)"
    ],
    "gradientStart": {
      "x": 0.18,
      "y": 0
    },
    "gradientEnd": {
      "x": 0.82,
      "y": 1
    },
    "borderColor": "rgba(255,255,255,0.62)",
    "borderWidth": 1,
    "blurAmount": 32,
    "saturate": 200,
    "solidBackground": "#E1ECDD",
    "shadow": null
  },
  "card": {
    "gradientColors": [
      "rgba(255,255,255,0.81)",
      "rgba(255,255,255,0.38)"
    ],
    "gradientStart": {
      "x": 0.18,
      "y": 0
    },
    "gradientEnd": {
      "x": 0.82,
      "y": 1
    },
    "borderColor": "rgba(255,255,255,0.62)",
    "borderWidth": 1,
    "blurAmount": 28,
    "saturate": 200,
    "solidBackground": "#DFEADA",
    "shadow": null
  },
  "soft": {
    "gradientColors": [
      "rgba(255,255,255,0.76)",
      "rgba(255,255,255,0.35)"
    ],
    "gradientStart": {
      "x": 0.18,
      "y": 0
    },
    "gradientEnd": {
      "x": 0.82,
      "y": 1
    },
    "borderColor": "rgba(255,255,255,0.72)",
    "borderWidth": 1,
    "blurAmount": 26,
    "saturate": 200,
    "solidBackground": "#DCE8D7",
    "shadow": null
  },
  "control": {
    "gradientColors": [
      "rgba(255,255,255,0.82)",
      "rgba(255,255,255,0.40)"
    ],
    "gradientStart": {
      "x": 0.18,
      "y": 0
    },
    "gradientEnd": {
      "x": 0.82,
      "y": 1
    },
    "borderColor": "rgba(255,255,255,0.62)",
    "borderWidth": 1,
    "blurAmount": 22,
    "saturate": 200,
    "solidBackground": "#E0EBDC",
    "shadow": null
  },
  "pill": {
    "gradientColors": [
      "rgba(255,255,255,0.82)",
      "rgba(255,255,255,0.47)"
    ],
    "gradientStart": {
      "x": 0.18,
      "y": 0
    },
    "gradientEnd": {
      "x": 0.82,
      "y": 1
    },
    "borderColor": "rgba(255,255,255,0.62)",
    "borderWidth": 1,
    "blurAmount": 24,
    "saturate": 200,
    "solidBackground": "#E3EDDF",
    "shadow": null
  },
  "tabBar": {
    "gradientColors": [
      "rgba(255,255,255,0.82)",
      "rgba(255,255,255,0.41)"
    ],
    "gradientStart": {
      "x": 0.18,
      "y": 0
    },
    "gradientEnd": {
      "x": 0.82,
      "y": 1
    },
    "borderColor": "rgba(255,255,255,0.62)",
    "borderWidth": 1,
    "blurAmount": 34,
    "saturate": 200,
    "solidBackground": "#E1EBDC",
    "shadow": null
  }
} as const;

export const shadows = {} as const;

export const radius = {
  "xs": 8,
  "sm": 10,
  "md": 14,
  "lg": 16,
  "xl": 18,
  "2xl": 20,
  "3xl": 22,
  "4xl": 24,
  "5xl": 26,
  "6xl": 28,
  "7xl": 30,
  "8xl": 32,
  "sheet": 34,
  "pill": 999
} as const;

export const spacing = {
  "0": 0,
  "1": 3,
  "2": 6,
  "3": 7,
  "4": 8,
  "5": 9,
  "6": 10,
  "7": 11,
  "8": 12,
  "9": 13,
  "10": 14,
  "11": 16,
  "12": 18,
  "13": 20,
  "14": 22,
  "15": 24,
  "16": 26,
  "17": 28,
  "18": 34,
  "19": 40,
  "20": 62
} as const;

export const typography = {
  "fontFamily": {
    "$note": "Open Sans is BUNDLED with the app (mobile/src/assets/fonts, web-admin/public/fonts). Never load from Google Fonts at runtime — the farmer app must work offline.",
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
    "screenTitle": {
      "size": 34,
      "weight": 800,
      "lineHeight": 1.16,
      "letterSpacing": -0.02
    },
    "displayLg": {
      "size": 32,
      "weight": 800,
      "lineHeight": 1,
      "letterSpacing": -0.02
    },
    "resultTitle": {
      "size": 26,
      "weight": 800,
      "lineHeight": 1.12,
      "letterSpacing": -0.02
    },
    "pageTitle": {
      "size": 25,
      "weight": 800,
      "lineHeight": 1.12,
      "letterSpacing": -0.02
    },
    "sectionTitleLg": {
      "size": 24,
      "weight": 700,
      "lineHeight": 1.2,
      "letterSpacing": -0.02
    },
    "sectionTitle": {
      "size": 23,
      "weight": 700,
      "lineHeight": 1.25,
      "letterSpacing": -0.02
    },
    "screenHeading": {
      "size": 21,
      "weight": 700,
      "lineHeight": 1.3,
      "letterSpacing": -0.01
    },
    "groupTitle": {
      "size": 19,
      "weight": 700,
      "lineHeight": 1.3,
      "letterSpacing": -0.01
    },
    "cardTitleLg": {
      "size": 18.5,
      "weight": 700,
      "lineHeight": 1.35,
      "letterSpacing": -0.01
    },
    "cardTitle": {
      "size": 16.5,
      "weight": 700,
      "lineHeight": 1.4,
      "letterSpacing": -0.01
    },
    "listTitle": {
      "size": 16,
      "weight": 700,
      "lineHeight": 1.4,
      "letterSpacing": -0.01
    },
    "input": {
      "size": 16,
      "weight": 600,
      "lineHeight": 1.4,
      "letterSpacing": 0
    },
    "bodyStrong": {
      "size": 15.5,
      "weight": 600,
      "lineHeight": 1.5,
      "letterSpacing": 0
    },
    "body": {
      "size": 15,
      "weight": 400,
      "lineHeight": 1.55,
      "letterSpacing": 0
    },
    "bodySm": {
      "size": 14.5,
      "weight": 600,
      "lineHeight": 1.5,
      "letterSpacing": 0
    },
    "meta": {
      "size": 13.5,
      "weight": 600,
      "lineHeight": 1.45,
      "letterSpacing": 0
    },
    "metaSm": {
      "size": 12.5,
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
    },
    "tabLabel": {
      "size": 10.5,
      "weight": 600,
      "lineHeight": 1.2,
      "letterSpacing": 0
    },
    "overline": {
      "size": 11,
      "weight": 700,
      "lineHeight": 1.2,
      "letterSpacing": 0.11,
      "textTransform": "uppercase"
    }
  }
} as const;

/** Disease severity -> colour. `severe` is opaque on purpose: it must stay readable in direct sun. */
export const severity = {
  "$note": "Disease severity → colour. 'severe' deliberately uses an OPAQUE background so it stays legible at a glance in direct sunlight — do not replace it with a translucent tint.",
  "none": {
    "key": "none",
    "label": "Khoẻ mạnh",
    "bg": "rgba(84,169,106,0.20)",
    "fg": "#2E6F40",
    "dot": "#2E6F40",
    "solidBg": "#C3DDC4"
  },
  "mild": {
    "key": "mild",
    "label": "Nhẹ",
    "bg": "rgba(195,210,74,0.18)",
    "fg": "#4A5810",
    "dot": "#4A5810",
    "solidBg": "#DAE6C0"
  },
  "moderate": {
    "key": "moderate",
    "label": "Trung bình",
    "bg": "rgba(242,161,4,0.20)",
    "fg": "#7A4F00",
    "dot": "#7A4F00",
    "solidBg": "#E3DBAF"
  },
  "severe": {
    "key": "severe",
    "label": "Nặng",
    "bg": "#C24A12",
    "fg": "#FFF3E8",
    "dot": "#E4661F",
    "solidBg": "#C24A12"
  }
} as const;

export const diseaseType = {
  "fungus": {
    "label": "Nấm",
    "bg": "rgba(195,210,74,0.16)",
    "fg": "#4A5810",
    "dot": "#4A5810"
  },
  "bacteria": {
    "label": "Vi khuẩn",
    "bg": "rgba(84,169,106,0.18)",
    "fg": "#2E6F40",
    "dot": "#2E6F40"
  },
  "virus": {
    "label": "Virus",
    "bg": "rgba(242,161,4,0.18)",
    "fg": "#7A4F00",
    "dot": "#7A4F00"
  },
  "pest": {
    "label": "Nhện hại",
    "bg": "rgba(255,255,255,0.78)",
    "fg": "rgba(18,48,29,0.85)",
    "dot": "rgba(23,58,36,0.70)"
  },
  "healthy": {
    "label": "Khoẻ",
    "bg": "rgba(84,169,106,0.20)",
    "fg": "#2E6F40",
    "dot": "#2E6F40"
  }
} as const;

/** Hard minimums from the field constraints - these outrank aesthetics. */
export const size = {
  "$note": "Field constraints (§3.4) — these are hard minimums, they outrank aesthetics.",
  "minTouchTarget": 48,
  "inputMinHeight": 50,
  "buttonMinHeight": 54,
  "buttonMinHeightSm": 46,
  "chipMinHeight": 44,
  "tabItemMinHeight": 52,
  "fab": 62,
  "iconButton": 44,
  "avatar": 46,
  "deviceWidth": 402,
  "deviceHeight": 874,
  "screenPaddingX": 16,
  "screenPaddingTop": 62
} as const;

export const motion = {
  "rise": {
    "duration": 320,
    "easing": "ease-out",
    "keyframes": "from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}"
  },
  "pulse": {
    "duration": 1600,
    "easing": "ease-in-out",
    "keyframes": "0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.07);opacity:1}"
  },
  "progress": {
    "duration": 500,
    "easing": "ease"
  }
} as const;

export type GlassLevel = keyof typeof glass;
export type SeverityKey = keyof typeof severity;
export type DiseaseTypeKey = keyof typeof diseaseType;
export type TypographyRole = keyof typeof typography.role;

const FONT = typography.fontFamily.sans;

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
    fontFamily: FONT_FILES[r.weight] ?? FONT,
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

/**
 * Container style for a glass surface.
 * @param level  which glass recipe
 * @param solid  true => opaque fallback ("Che do ngoai nang" / low-end devices)
 */
export function surface(level: GlassLevel, solid = false): ViewStyle {
  const g = glass[level];
  const base: ViewStyle = {
    borderWidth: g.borderWidth,
    borderColor: g.borderColor,
  };
  if (solid) base.backgroundColor = g.solidBackground;
  if (g.shadow) Object.assign(base, g.shadow);
  return base;
}

export const theme = {
  colors,
  gradients,
  halo,
  glass,
  shadows,
  radius,
  spacing,
  typography,
  severity,
  diseaseType,
  size,
  motion,
  text,
  surface,
} as const;

export default theme;
