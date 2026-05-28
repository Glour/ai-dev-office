"use client";

import { PlusIcon } from "lucide-react";
import { FileDropzone } from "@/components/dashboard/file-dropzone";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";

export function TaskForm({ action }: { action: string }) {
  return (
    <form action={action} className="grid gap-3" encType="multipart/form-data" method="post">
      <Textarea
        aria-label="Описание задачи"
        name="ownerRequest"
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Сформулировать задачу для офиса..."
        required
        rows={5}
      />
      <FileDropzone description="Файлы попадут в задачу как артефакты, а главный ассистент увидит их вместе с текстом." />
      <input type="hidden" name="routeType" value="owner_request" />
      <input type="hidden" name="assignedDepartment" value="management" />
      <input type="hidden" name="assignedAgent" value="owner-assistant" />
      <input type="hidden" name="riskLevel" value="medium" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-48">
          <SelectField aria-label="Приоритет" defaultValue="normal" name="priority">
            <option value="low">Низкий</option>
            <option value="normal">Обычный</option>
            <option value="high">Высокий</option>
            <option value="urgent">Срочный</option>
          </SelectField>
        </div>
        <Button className="w-full sm:w-auto" type="submit">
          <PlusIcon className="size-4" />
          Отправить
        </Button>
      </div>
    </form>
  );
}
