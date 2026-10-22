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


## Dosya yükleme ve ortak analiz

Sohbet alanında Dosya Ekle veya sürükle-bırak kullanın. PDF, DOCX, XLSX,
CSV, TXT, Markdown ve PNG/JPG/WEBP görselleri desteklenir; en fazla 6 dosya,
dosya başına 12 MB. Çıkarılan metin yerel data/attachments klasöründe saklanır.
Ham yüklenen belgeler kalıcı olarak saklanmaz.

- PDF: ilk 80 sayfanın seçilebilir metnini okur; taranmış metinsiz ilk iki
  sayfa görsel modelle yorumlanır, diğer taranmış sayfalar okunamadı işaretlenir.
- Excel: ilk 25 sayfa, her sayfada 1200 satır ve 32 sütunun önceden hesaplanmış
  değerlerini okur. Formül hesaplamaz.
- Word: paragraf ve tabloları işler; bütün gömülü şekilleri okumaz.
- Fotoğraf: yerel gemma3:4b görsel modeli açıklama üretir, diğer modeller
  bu açıklamayı değerlendirir. Diğer modeller fotoğrafı doğrudan görmez.
- Büyük belgelerde soru ile ilgili bölümler seçilir; tüm dosya bütünüyle
  analiz edilmiş gibi gösterilmez.
- DWG/DXF henüz desteklenmez; teknik metrajda CAD ayrıştırma gerekir.

### Normal ve derin konsey

Normal konsey: qwen3:8b, qwen2.5-coder:7b, gemma3:4b. Başkan: qwen3:8b.
Kendi .env dosyanızda modelleri seçebilirsiniz. Tüm modellerle derin konsey
seçildiğinde kurulu qwen3-coder:30b gibi büyük modeller de katılır. Bunlar
sırayla çalışır ve 8 GB VRAM üzerinde daha yavaş olabilir. Yerel gemma3:4b
modelini eklemek için: ollama pull gemma3:4b

### Kontroller

Windows proje klasöründe Python testleri:
    uv run python -m unittest discover -s tests -v

Arayüzü derlemek ve bağımlılıkları taramak:
    cd frontend
    npm.cmd run build
    npm.cmd audit

Birden fazla modelin uzlaşması teknik doğruluk garantisi değildir; özellikle
statik, metraj, şartname ve mevzuatta kaynak veriler doğrulanmalıdır.


## İsteğe bağlı Google Gemini (ücretsiz proje)

Bu sürümde Ollama'nın yanında **Gemini 2.5 Flash** da tek tek sorulara
katılabilir. **Varsayılan kapalıdır**, API anahtarı yoksa normal yerel konsey
çalışmaya devam eder.

1. https://aistudio.google.com/api-keys adresinde kendi Google hesabınızla
   **Free Tier / ücretsiz katman** projesi oluşturun. Projede faturalandırma
   bağlı olmadığını doğrulayın; ödeme veya ücretli katmana geçiş yapmayın.
2. Yerel uygulamanın üstündeki **Gemini bağla** düğmesini açın.
3. API anahtarını yalnızca bilgisayarınızdaki karakterleri gizleyen giriş alanına yapıştırın;
   projenizin ücretsiz olduğunu onaylayıp **Kaydet** düğmesine basın.
4. Belirli bir soruda Gemini'yi dahil etmek istiyorsanız sohbet alanındaki
   **Gemini'yi de kat (Google'a veri gönderir)** kutusunu açın.
5. Her soru tamamlandığında kutu kendiliğinden kapanır. Gemini API hatası veya
   kota sınırında diğer yerel modellerle değerlendirme devam eder.

### Önemli maliyet ve gizlilik sınırları

- **Kullanıcının kontrolü olmadan bulut bağlantısı ve Gemini çağrısı yapılamaz.**
- Kod yalnızca gemini-2.5-flash modeline izin verir; pahalı modellere
  kendiliğinden geçmez, hata durumunda otomatik yeniden denemez.
- Uygulama kendi tarafında **UTC gününe göre en fazla 12 Google API isteği**
  gönderir. Bu, Google'ın kendi proje kotasının yerine geçmez.
- **Faturalandırmaya bağlı bir Google projesindeki ücretsiz model adı,
  ücret doğmayacağını garanti etmez.** Bu uygulama Google projenizde
  faturalandırmanın kapalı olduğunu kendiliğinden doğrulayamaz.
  Ücret oluşmasını önlemek için faturalandırmasız Free Tier proje kullanın.
- Google Gemini kutusu açılırsa soru ve yüklediğiniz belgelerden seçilen
  metin parçaları Google'a iletilir. Görseller Google'a doğrudan gönderilmez;
  yerel Gemma modelinin çıkardığı açıklama gidebilir.
- Gemini Free Tier içerikleri Google tarafından ürün geliştirme amacıyla
  kullanılabilir. **Gizli müşteri projelerinde Gemini'yi seçmeyin; Ollama'yı
  yerel modda kullanın.**
- API anahtarı Windows proje klasöründeki git-ignored **.env** içinde kalır;
  GitHub'a gönderilmez ve tarayıcıya geri okunmaz.
- **Bağlantıyı kaldır** düğmesi uygulamanın .env içindeki anahtarı temizler.
  Bu işlem Google hesabınızdaki anahtarı iptal etmez; kalıcı iptal için
  ayrıca Google AI Studio'dan anahtarı silin.
- ChatGPT aboneliği ve Claude web aboneliği bu projeye otomatik API erişimi
  sağlamaz. OpenAI veya Anthropic ücretli API çağrıları eklenmemiştir.

API anahtarı bilgisayarınızda yoksa konseyin mevcut ücretsiz yerel sürümü
değişmeden çalışır.
