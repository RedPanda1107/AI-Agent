import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateProjectDto) {
    return this.prisma.project.create({ data });
  }

  list() {
    return this.prisma.project.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async findById(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} was not found`);
    return project;
  }

  async update(id: string, data: UpdateProjectDto) {
    await this.findById(id);
    return this.prisma.project.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
