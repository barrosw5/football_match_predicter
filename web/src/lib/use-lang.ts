"use client";

import { useSyncExternalStore } from "react";

import type { Lang } from "./i18n";

const EVENT = "langchange";

function read(): Lang {
  return document.documentElement.dataset.lang === "pt" ? "pt" : "en";
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

/** Current language for strings that cannot be rendered with <T> (attributes, SVG text). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "en");
}

export function setLang(lang: Lang) {
  const root = document.documentElement;
  root.dataset.lang = lang;
  root.lang = lang === "pt" ? "pt-PT" : "en";
  try {
    localStorage.setItem("lang", lang);
  } catch {
    // private mode: the choice just isn't remembered
  }
  window.dispatchEvent(new Event(EVENT));
}
