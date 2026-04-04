import { Offboarding } from "../models/Offboarding.js";
import { createEntity, deleteEntity, listEntities, updateEntity } from "./crudFactory.js";

export const getOffboarding = listEntities(Offboarding);
export const createOffboarding = createEntity(Offboarding);
export const updateOffboarding = updateEntity(Offboarding);
export const deleteOffboarding = deleteEntity(Offboarding);
