/* eslint-disable @typescript-eslint/no-explicit-any */
export abstract class BaseRepository<T> {
  protected model: any;

  constructor(model: any) {
    this.model = model;
  }

  async findById(id: string): Promise<T | null> {
    try {
      return await this.model.findUnique({
        where: { id },
      });
    } catch (error) {
      console.error(`Error finding ${this.model.name} by id:`, error);
      throw new Error(`Erro ao buscar registro por ID`);
    }
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    orderBy?: Record<string, "asc" | "desc">;
    where?: Record<string, unknown>;
  }): Promise<T[]> {
    try {
      return await this.model.findMany(options);
    } catch (error) {
      console.error(`Error finding all ${this.model.name}:`, error);
      throw new Error(`Erro ao buscar registros`);
    }
  }

  async create(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T> {
    try {
      return await this.model.create({
        data,
      });
    } catch (error) {
      console.error(`Error creating ${this.model.name}:`, error);
      throw new Error(`Erro ao criar registro`);
    }
  }

  async update(
    id: string,
    data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>
  ): Promise<T> {
    try {
      return await this.model.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error(`Error updating ${this.model.name}:`, error);
      throw new Error(`Erro ao atualizar registro`);
    }
  }

  async delete(id: string): Promise<T> {
    try {
      return await this.model.delete({
        where: { id },
      });
    } catch (error) {
      console.error(`Error deleting ${this.model.name}:`, error);
      throw new Error(`Erro ao deletar registro`);
    }
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    try {
      return await this.model.count({ where });
    } catch (error) {
      console.error(`Error counting ${this.model.name}:`, error);
      throw new Error(`Erro ao contar registros`);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const record = await this.model.findUnique({
        where: { id },
        select: { id: true },
      });
      return !!record;
    } catch (error) {
      console.error(`Error checking if ${this.model.name} exists:`, error);
      throw new Error(`Erro ao verificar existência do registro`);
    }
  }
}
