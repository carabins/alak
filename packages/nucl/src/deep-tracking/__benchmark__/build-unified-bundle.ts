import { rolldown } from 'rolldown';
import * as path from 'path';
import * as fs from 'fs';

async function buildUnifiedBundle() {
  // Пути к исходным файлам
  const unifiedVersionPath = path.join(process.cwd(), 'packages', 'nucl', 'src', 'deep-tracking', '__benchmark__', 'unified-version.ts');

  // Папка для вывода бандлов
  const outputDir = path.join(process.cwd(), 'packages', 'nucl', 'src', 'deep-tracking', '__benchmark__', 'bundles');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Собрать объединённую версию
    console.log('Сборка объединённой версии...');
    const unifiedBuild = await rolldown({
      input: unifiedVersionPath,
      external: (id) => {
        // Сделать зависимости внешними
        return id.startsWith('@vue/') || id === '@vue/reactivity';
      }
    });

    const unifiedOutputPath = path.join(outputDir, 'unified-version.js');
    await unifiedBuild.write({
      format: 'es',
      file: unifiedOutputPath,
      exports: 'named',
    });

    console.log(`Объединённая версия собрана: ${unifiedOutputPath}`);

    console.log('Объединённая версия успешно собрана в папке bundles');
  } catch (error) {
    console.error('Ошибка при сборке объединённой версии:', error);
  }
}

// Запустить сборку
buildUnifiedBundle();