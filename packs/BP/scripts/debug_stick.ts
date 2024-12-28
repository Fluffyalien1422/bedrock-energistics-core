import { ItemCustomComponent, Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { setMachineStorage } from "./data";

export const debugStickComponent: ItemCustomComponent = {
  onUseOn(e) {
    if (!e.block.hasTag("fluffyalien_energisticscore:machine")) return;

    const form = new ModalFormData()
      .title("Debug Menu")
      .textField("Storage Type ID", "energy")
      .textField("Value", "0");

    void form.show(e.source as Player).then((response) => {
      if (!response.formValues) return;

      const id = response.formValues[0] as string;
      const value = Number(response.formValues[1]);

      if (isNaN(value)) {
        throw new Error("Debug menu: value field must be a number.");
      }

      setMachineStorage(e.block, id, value);
    });
  },
};
