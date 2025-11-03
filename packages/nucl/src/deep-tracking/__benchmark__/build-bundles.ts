import { rolldown } from 'rolldown';
import * as path from 'path';
import * as fs from 'fs';

async function buildBundles() {
  // Пути к исходным файлам
  const currentVersionPath = path.join(process.cwd(), 'packages', 'nucl', 'src', 'deep-tracking', 'index.ts');
  const oldVersionPath = path.join(process.cwd(), 'packages', 'nucl', 'src', 'deep-tracking', 'oldversion.ts');

  // Папка для вывода бандлов
  const outputDir = path.join(process.cwd(), 'packages', 'nucl', 'src', 'deep-tracking', '__benchmark__', 'bundles');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Собрать текущую версию
    console.log('Сборка текущей версии...');
    const currentBuild = await rolldown({
      input: currentVersionPath,
      external: (id) => {
        // Сделать зависимости внешними
        return id.startsWith('@vue/') || id === '@vue/reactivity';
      }
    });

    const currentOutputPath = path.join(outputDir, 'current-version.js');
    await currentBuild.write({
      format: 'es',
      file: currentOutputPath,
      exports: 'named',
    });

    console.log(`Текущая версия собрана: ${currentOutputPath}`);

    // Собрать старую версию
    console.log('Сборка старой версии...');
    const oldBuild = await rolldown({
      input: oldVersionPath,
      external: (id) => {
        // Сделать зависимости внешними
        return id.startsWith('@vue/') || id === '@vue/reactivity';
      }
    });

    const oldOutputPath = path.join(outputDir, 'old-version.js');
    await oldBuild.write({
      format: 'es',
      file: oldOutputPath,
      exports: 'named',
    });

    console.log(`Старая версия собрана: ${oldOutputPath}`);

    console.log('Обе версии успешно собраны в папке bundles');
  } catch (error) {
    console.error('Ошибка при сборке:', error);
  }
}

// Запустить сборку
buildBundles();