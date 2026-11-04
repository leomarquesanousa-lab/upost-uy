'use server';

import { revalidatePath } from 'next/cache';

import { requireMutation } from '@/lib/auth/editorial';
import {
  deleteVideo,
  saveVideo,
} from '@/server/services/videos';

import { editorialMessage } from '@/server/services/editorial';

export type VideoActionResult = {
  error?: string;
  id?: string;
  ok?: boolean;
};

export async function videoAction(
  form: FormData,
): Promise<VideoActionResult> {
  try {
    const user =
      await requireMutation();

    if (
      form.get('intent') ===
      'delete'
    ) {
      await deleteVideo(
        form,
        user.id,
      );

      revalidatePath(
        '/',
        'layout',
      );

      return {
        ok: true,
      };
    }

    const id = await saveVideo(
      form,
      user.id,
    );

    revalidatePath(
      '/',
      'layout',
    );

    return {
      ok: true,
      id,
    };
  } catch (error) {
    return {
      error:
        editorialMessage(error),
    };
  }
}