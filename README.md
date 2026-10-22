# LLM Council — ücretsiz yerel Ollama sürümü

Bu depo Andrej Karpathy'nin [LLM Council](https://github.com/karpathy/llm-council) uygulamasından uyarlanmıştır. **Bu sürümde OpenRouter, ücretli API anahtarı veya otomatik kredi yüklemesi kullanılmaz.** Bütün model istekleri bilgisayarınızdaki Ollama API'sine (localhost) gönderilir.

## Çalışma mantığı

1. Bilgisayarda mevcut en fazla **iki sohbet modeli** soruyu ayrı ayrı yanıtlar.
2. Modeller birbirlerinin yanıtlarını karşılaştırır ve sıralar.
3. Yerel bir başkan modeli son yanıtı hazırlar.

Varsayılan olarak yüklü modeller otomatik seçilir; herhangi bir model otomatik olarak indirilmez. Yerel yapay zekâlar özellikle CPU üzerinde yavaş çalışabilir. İki farklı model kurulu değilse konsey tek modelle de çalışabilir, ancak görüş çeşitliliği azalır.

## Gerekenler (Windows)

- Ollama (https://ollama.com/) — kurulu ve açık
- Git (https://git-scm.com/downloads/win)
- Python 3.10+ ve uv (https://docs.astral.sh/uv/)
- Node.js LTS (https://nodejs.org/)

PowerShell'de şunları kontrol edin:

~~~powershell
ollama --version
ollama list
git --version
uv --version
node --version
npm.cmd --version
~~~

Ollama model listesi boşsa bilgisayarınızın RAM/ekran kartına uygun bir sohbet modeli indirmeniz gerekir. Örneğin küçük bir başlangıç modeli:

~~~powershell
ollama pull llama3.2:3b
~~~

Bu komut internetten bir defalık ücretsiz model indirir. Mevcut modelleriniz varsa atlayın.

## Projeyi kur

~~~powershell
git clone https://github.com/Wa8tppeV/llm-council.git
cd llm-council
uv sync
cd frontend
npm.cmd install
cd ..
~~~

Projeyi önceden bilgisayarınıza indirdiyseniz aynı klasörde git pull çalıştırın. Yerel kod değişikliklerinizi önce yedekleyin.

## Çalıştırma

Proje klasöründe iki ayrı PowerShell açın:

**Pencere 1 (backend)**

~~~powershell
uv run python -m backend.main
~~~

**Pencere 2 (frontend)**

~~~powershell
cd frontend
npm.cmd run dev
~~~

Tarayıcıda http://localhost:5173 adresini açın.

Bağlantı ve model durumunu görmek için http://localhost:8001/api/status adresini ziyaret edin. Yanıtta connected: true ve selected_models içerisinde en az bir model adı olmalıdır.

Windows için otomatik başlatıcı da eklendi. Gerekli kurulumları yaptıktan sonra proje klasöründe şu komutu çalıştırabilirsiniz:

~~~powershell
powershell -NoProfile -File .\baslat-windows.ps1
~~~

Başlatıcı Ollama servisini gerekirse otomatik açar, açık olan servisleri tekrar başlatmaz. Yeni model veya başka yazılım otomatik indirilmez.

## İsteğe bağlı: modelleri elle seç

.env dosyası **zorunlu değildir**. Otomatik seçim ilk iki yerel sohbet modelini kullanır. İsterseniz proje kökünde .env oluşturarak şunları yazın:

~~~dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODELS=llama3.2:3b,gemma3:4b
OLLAMA_CHAIRMAN_MODEL=llama3.2:3b
OLLAMA_MAX_OUTPUT_TOKENS=768
~~~

**Model adları örnektir.** Bilgisayarda kurulu gerçek model adlarını ollama list ile öğrenin. Dosya GitHub'a yüklenmemelidir.

## Güvenlik ve maliyet

- Tüm istekler localhost üzerindeki Ollama servisine gider.
- Bu projede OpenRouter/ücretli sağlayıcı istekleri yoktur, API anahtarı istenmez.
- Bulut olarak işaretlenmiş ve embedding/reranking modelleri konsey listesinden filtrelenir.
- Python backend sadece 127.0.0.1:8001 adresini dinler.
- Sohbet geçmişi yerel data/conversations klasörüne yazılır.
- İndirilen yerel modellerle sorgulama için model başına ücret veya günlük API kotası yoktur. Donanım, elektrik ve ilk indirme için internet tüketimi ayrı konulardır.

Orijinal kaynak: https://github.com/karpathy/llm-council
