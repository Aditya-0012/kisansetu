import { CROP_LABELS, CropCategory } from "@kisansetu/shared";
import { TFunction } from "i18next";

export function getCropName(crop: string | CropCategory | undefined | null, t: TFunction): string {
  if (!crop) return "";
  const key = crop.toLowerCase();
  return t(`crops.${key}`, CROP_LABELS[key as CropCategory] ?? crop);
}

export function getCropLabel(crop: string | CropCategory | undefined | null, t?: TFunction): string {
  if (!crop) return "";
  const key = crop.toLowerCase();
  if (t) {
    return t(`crops.${key}`, CROP_LABELS[key as CropCategory] ?? crop);
  }
  return CROP_LABELS[key as CropCategory] ?? crop;
}
