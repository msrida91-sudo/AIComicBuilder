import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { id as genId } from "@/lib/id";

export type Protocol = "openai" | "gemini" | "seedance" | "ucloud-seedance" | "kling" | "wan" | "dashscope";
export type Capability = "text" | "image" | "video";

export interface Model {
  id: string;
  name: string;
  checked: boolean;
}

export interface Provider {
  id: string;
  name: string;
  protocol: Protocol;
  capability: Capability;
  baseUrl: string;
  models: Model[];
}

export interface ModelRef {
  providerId: string;
  modelId: string;
}

export interface ModelConfig {
  text: { protocol: Protocol; baseUrl: string; modelId: string } | null;
  image: { protocol: Protocol; baseUrl: string; modelId: string } | null;
  video: { protocol: Protocol; baseUrl: string; modelId: string } | null;
}

interface ModelStore {
  providers: Provider[];
  defaultTextModel: ModelRef | null;
  defaultImageModel: ModelRef | null;
  defaultVideoModel: ModelRef | null;

  addProvider: (provider: Omit<Provider, "id" | "models">) => string;
  updateProvider: (id: string, updates: Partial<Omit<Provider, "id">>) => void;
  removeProvider: (id: string) => void;
  setModels: (providerId: string, models: Model[]) => void;
  toggleModel: (providerId: string, modelId: string) => void;
  addManualModel: (providerId: string, modelId: string) => void;
  removeModel: (providerId: string, modelId: string) => void;
  setDefaultTextModel: (ref: ModelRef | null) => void;
  setDefaultImageModel: (ref: ModelRef | null) => void;
  setDefaultVideoModel: (ref: ModelRef | null) => void;
  getModelConfig: () => ModelConfig;
}


// Do not spread persisted provider objects: older versions contain credentials.
function metadataOnly(value: unknown) {
  const state = (value ?? {}) as Partial<ModelStore>;
  return {
    providers: (state.providers ?? []).map((p) => ({
      id: p.id, name: p.name, protocol: p.protocol, capability: p.capability || "text" as Capability,
      baseUrl: p.baseUrl,
      models: (p.models ?? []).map((m) => ({ id: m.id, name: m.name, checked: m.checked })),
    })),
    defaultTextModel: state.defaultTextModel ? { providerId: state.defaultTextModel.providerId, modelId: state.defaultTextModel.modelId } : null,
    defaultImageModel: state.defaultImageModel ? { providerId: state.defaultImageModel.providerId, modelId: state.defaultImageModel.modelId } : null,
    defaultVideoModel: state.defaultVideoModel ? { providerId: state.defaultVideoModel.providerId, modelId: state.defaultVideoModel.modelId } : null,
  };
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      providers: [],
      defaultTextModel: null,
      defaultImageModel: null,
      defaultVideoModel: null,

      addProvider: (provider) => {
        const id = genId();
        set((state) => ({
          providers: [...state.providers, { ...provider, id, models: [] }],
        }));
        return id;
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      removeProvider: (id) => {
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== id),
          defaultTextModel:
            state.defaultTextModel?.providerId === id ? null : state.defaultTextModel,
          defaultImageModel:
            state.defaultImageModel?.providerId === id ? null : state.defaultImageModel,
          defaultVideoModel:
            state.defaultVideoModel?.providerId === id ? null : state.defaultVideoModel,
        }));
      },

      setModels: (providerId, models) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === providerId ? { ...p, models } : p
          ),
        }));
      },

      toggleModel: (providerId, modelId) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === providerId
              ? {
                  ...p,
                  models: p.models.map((m) =>
                    m.id === modelId ? { ...m, checked: !m.checked } : m
                  ),
                }
              : p
          ),
        }));
      },

      addManualModel: (providerId, modelId) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === providerId
              ? {
                  ...p,
                  models: [
                    ...p.models,
                    { id: modelId, name: modelId, checked: true },
                  ],
                }
              : p
          ),
        }));
      },

      removeModel: (providerId, modelId) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === providerId
              ? { ...p, models: p.models.filter((m) => m.id !== modelId) }
              : p
          ),
        }));
      },

      setDefaultTextModel: (ref) => set({ defaultTextModel: ref }),
      setDefaultImageModel: (ref) => set({ defaultImageModel: ref }),
      setDefaultVideoModel: (ref) => set({ defaultVideoModel: ref }),

      getModelConfig: () => {
        const state = get();
        function resolve(ref: ModelRef | null) {
          if (!ref) return null;
          const provider = state.providers.find((p) => p.id === ref.providerId);
          if (!provider) return null;
          return {
            protocol: provider.protocol,
            baseUrl: provider.baseUrl,
            modelId: ref.modelId,
          };
        }
        return {
          text: resolve(state.defaultTextModel),
          image: resolve(state.defaultImageModel),
          video: resolve(state.defaultVideoModel),
        };
      },
    }),
    {
      name: "model-store",
      version: 3,
      // Rewrite legacy storage through a strict metadata allowlist before hydration.
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          try {
            const saved = JSON.parse(raw);
            saved.state = metadataOnly(saved.state);
            const clean = JSON.stringify(saved);
            localStorage.setItem(name, clean);
            return clean;
          } catch {
            localStorage.removeItem(name);
            return null;
          }
        },
        setItem: (name: string, value: string) => {
          const saved = JSON.parse(value);
          saved.state = metadataOnly(saved.state);
          localStorage.setItem(name, JSON.stringify(saved));
        },
        removeItem: (name: string) => localStorage.removeItem(name),
      })),
      partialize: metadataOnly,
      migrate: (state: unknown) => metadataOnly(state),
      merge: (state: unknown, current) => ({ ...current, ...metadataOnly(state) }),
    }
  )
);
