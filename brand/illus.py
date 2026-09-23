# Original line illustrations of generic garments for the Bella Rosa collection covers.
PLUM = "#5B2A3C"
def _svg(inner, stroke=PLUM, width=2.2, size=420):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 20 160 230" width="{size}" fill="none" stroke="{stroke}" '
            f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>')

def occasion_dress(fill="#F3DCE0", **kw):
    return _svg(f'''
    <path d="M78 110 C60 150 44 190 34 230 C44 236 54 236 64 231 C74 237 86 237 96 232 C106 237 118 237 128 232 C138 237 150 236 166 230 C156 190 140 150 122 110 Z" fill="{fill}"/>
    <path d="M86 118 C76 152 66 190 58 228" stroke-width="1.1"/>
    <path d="M114 118 C124 152 134 190 142 228" stroke-width="1.1"/>
    <path d="M100 122 C100 160 99 200 98 232" stroke-width="1.1"/>
    <path d="M74 58 C76 80 78 96 78 110 C92 114 108 114 122 110 C122 96 124 80 126 58 C118 50 108 52 100 56 C92 52 82 50 74 58 Z" fill="#FBF7F4"/>
    <path d="M84 50 C90 58 110 58 116 50"/>
    <path d="M74 58 C60 52 52 66 60 76 C66 72 70 66 76 62"/>
    <path d="M126 58 C140 52 148 66 140 76 C134 72 130 66 124 62"/>
    <path d="M100 112 C90 100 82 106 85 114 C88 121 96 119 100 112 Z" fill="#FBF7F4"/>
    <path d="M100 112 C110 100 118 106 115 114 C112 121 104 119 100 112 Z" fill="#FBF7F4"/>
    <path d="M98 114 L92 130 M102 114 L108 130"/>
    <circle cx="100" cy="112" r="2.6" fill="{PLUM}" stroke="none"/>''', **kw)

def day_dress(fill="#F3DCE0", **kw):
    return _svg(f'''
    <path d="M80 64 C78 120 66 180 58 226 C86 234 114 234 142 226 C134 180 122 120 120 64 C112 56 106 54 100 54 C94 54 88 56 80 64 Z" fill="{fill}"/>
    <path d="M86 46 L68 52 L60 74 L76 78 L80 64"/>
    <path d="M114 46 L132 52 L140 74 L124 78 L120 64"/>
    <path d="M86 46 C92 54 108 54 114 46" />
    <path d="M86 46 C80 58 94 64 100 54 C106 64 120 58 114 46" fill="#FBF7F4"/>
    <circle cx="100" cy="74" r="2.2" fill="{PLUM}" stroke="none"/><circle cx="100" cy="88" r="2.2" fill="{PLUM}" stroke="none"/><circle cx="100" cy="102" r="2.2" fill="{PLUM}" stroke="none"/>
    <path d="M70 168 C70 184 88 184 88 168 Z" fill="#FBF7F4"/>
    <path d="M112 168 C112 184 130 184 130 168 Z" fill="#FBF7F4"/>
    <path d="M62 212 C88 220 112 220 138 212" stroke-width="1.1"/>''', **kw)

def baby_romper(fill="#F3DCE0", **kw):
    return _svg(f'''
    <path d="M72 80 C70 118 68 150 70 176 C74 198 88 204 92 220 L108 220 C112 204 126 198 130 176 C132 150 130 118 128 80 L136 96 L154 86 L140 58 L118 48 C112 58 88 58 82 48 L60 58 L46 86 L64 96 Z" fill="{fill}"/>
    <path d="M82 48 C88 62 112 62 118 48" fill="#FBF7F4"/>
    <path d="M70 176 C82 180 90 196 92 220" stroke-width="1.1"/>
    <path d="M130 176 C118 180 110 196 108 220" stroke-width="1.1"/>
    <circle cx="94" cy="214" r="1.9" fill="{PLUM}" stroke="none"/><circle cx="100" cy="214" r="1.9" fill="{PLUM}" stroke="none"/><circle cx="106" cy="214" r="1.9" fill="{PLUM}" stroke="none"/>
    <path d="M60 58 C64 66 64 78 64 96" stroke-width="1.1"/><path d="M140 58 C136 66 136 78 136 96" stroke-width="1.1"/>
    <path d="M93 112 C88 104 93 96 100 101 C107 96 112 104 107 112 L100 120 Z" fill="#FBF7F4" stroke-width="1.6"/>''', **kw)

def bow_headband(fill="#F3DCE0", **kw):
    return _svg(f'''
    <path d="M100 116 C74 74 28 82 34 118 C40 152 80 146 100 116 Z" fill="{fill}"/>
    <path d="M100 116 C126 74 172 82 166 118 C160 152 120 146 100 116 Z" fill="{fill}"/>
    <path d="M100 116 C80 100 60 98 46 104" stroke-width="1.1"/><path d="M100 116 C82 118 64 126 52 136" stroke-width="1.1"/>
    <path d="M100 116 C120 100 140 98 154 104" stroke-width="1.1"/><path d="M100 116 C118 118 136 126 148 136" stroke-width="1.1"/>
    <path d="M96 124 C88 150 78 176 66 198 L80 202 L88 188 C94 170 99 148 101 126" fill="{fill}"/>
    <path d="M104 124 C112 150 122 176 134 198 L120 202 L112 188 C106 170 101 148 99 126" fill="{fill}"/>
    <rect x="90" y="104" width="20" height="23" rx="8" fill="#FBF7F4"/>
    <path d="M94 110 C98 108 102 108 106 110" stroke-width="1"/>''', **kw)
