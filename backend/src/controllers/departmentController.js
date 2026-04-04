import { Department } from "../models/Department.js";
import { createEntity, deleteEntity, listEntities, updateEntity } from "./crudFactory.js";

export const getDepartments = listEntities(Department);
export const createDepartment = createEntity(Department);
export const updateDepartment = updateEntity(Department);
export const deleteDepartment = deleteEntity(Department);
