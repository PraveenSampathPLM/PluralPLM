import { create } from "zustand";

interface ContainerState {
  selectedContainerId: string;
  setSelectedContainerId: (containerId: string) => void;
}

const storageKey = "plm_selected_container_id";

export const useContainerStore = create<ContainerState>((set) => ({
  selectedContainerId: localStorage.getItem(storageKey) ?? "",
  setSelectedContainerId: (containerId) => {
    localStorage.setItem(storageKey, containerId);
    set({ selectedContainerId: containerId });
  }
}));

