import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { ProjectService } from './project.service';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Post()
  create(@Body() body: CreateProjectDto) {
    return this.projects.create(body);
  }

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.projects.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateProjectDto) {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }
}
