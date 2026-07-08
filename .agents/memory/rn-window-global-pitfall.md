---
name: RN window global pitfall
description: typeof window !== "undefined" is not a reliable web-only check in React Native / Expo apps.
---

# React Native's `window` global is not web-exclusive

`typeof window !== "undefined"` is a common pattern to detect "am I running in a
browser", but in React Native (and Expo, all platforms) `window` is aliased to
`global` for compatibility with web libraries that expect it to exist. This means
the check passes on iOS/Android too — it does NOT mean DOM/browser APIs are present.

**Symptom:** code gated only on `typeof window !== "undefined"` calls a browser-only
method (e.g. `window.addEventListener`, `window.location`, `window.fetch` overrides)
and crashes on native with `window.<method> is not a function (it is undefined)`,
even though the same code runs fine on web.

**Why:** RN's global polyfill provides the `window` identifier for import
compatibility but does not implement the full DOM API surface.

**How to apply:** For any code that must only run in a real browser (web platform),
gate on `Platform.OS === "web"` (from `react-native`) in addition to (or instead of)
`typeof window !== "undefined"`. For extra safety when calling a specific method,
also check `typeof window.<method> === "function"` before calling it.
