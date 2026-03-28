import Link from 'next/link';
import TestimonialCard from '@/components/TestimonialCard';

export default function Home() {
  return (
    <>
      {/* Overview */}
      <section id="overview" className="section">
        <div className="container">
          <h2>Course Overview</h2>
          <div className="overview-grid">
            <div className="info-card">
              <h3>Course ID</h3>
              <p>2950</p>
            </div>
            <div className="info-card">
              <h3>Credits</h3>
              <p>6 Credits</p>
            </div>
            <div className="info-card">
              <h3>Program</h3>
              <p>Computer Engineering</p>
            </div>
            <div className="info-card repo-card">
              <h3>Repository</h3>
              <p>
                <a href="https://github.com/milmor/NLP" target="_blank" rel="noopener noreferrer">
                  github.com/milmor/NLP
                </a>
              </p>
            </div>
          </div>

          <div className="description">
            <p>
              This course provides a comprehensive introduction to Natural Language Processing using Deep
              Learning techniques. Starting with machine learning fundamentals for text classification,
              students progress through neural network architectures (perceptrons, RNNs, LSTMs, Transformers)
              to state-of-the-art models like BERT and GPT. The course also covers language and vision models,
              including CNNs, VAEs, GANs, and diffusion models for text-to-image generation.
            </p>
          </div>

          <div className="prerequisites-warning">
            <h3>⚠️ Prerequisites Required</h3>
            <p>This course requires strong foundations in:</p>
            <ul className="prereq-list">
              <li><strong>Linear Algebra</strong> – matrices, vectors, transformations</li>
              <li><strong>Calculus</strong> – derivatives, gradients, chain rule</li>
              <li><strong>Probability &amp; Statistics</strong> – distributions, Bayes&apos; theorem</li>
              <li><strong>Programming</strong> – Python proficiency required</li>
            </ul>
            <p className="prereq-note">
              See <Link href="/prerequisites">student background data</Link> from previous semesters.
            </p>
          </div>

          <div className="course-objectives">
            <h3>Course Objectives</h3>
            <ul>
              <li>
                Understand the fundamental concepts of deep learning and their application in NLP, such as
                text representation and neural networks.
              </li>
              <li>
                Acquire practical skills for developing and training NLP models using deep learning techniques.
              </li>
              <li>
                Apply the knowledge gained to real-world NLP use cases, such as sentiment analysis, machine
                translation, text generation, and data generation from natural language.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Syllabus */}
      <section id="syllabus" className="section section-alt">
        <div className="container">
          <h2>Course Syllabus</h2>
          <p className="section-intro syllabus-note">The program and dates below are subject to change.</p>

          <div className="syllabus-table">
            <table>
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Topic</th>
                  <th>Materials</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>
                    <strong>Machine Learning &amp; NLP Fundamentals</strong>
                    <p>Text classification, bag of words, n-grams, Naive Bayes, maximum likelihood, logistic regression</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://hastie.su.domains/ElemStatLearn/">The Elements of Statistical Learning</a>
                    {' '}(Hastie et al.), §4.4 Logistic Regression, p. 119
                  </td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>
                    <strong>Text Representation &amp; Evaluation</strong>
                    <p>TF-IDF, PCA, stemming, lemmatization, Zipf&apos;s law, precision/recall/F1</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://hastie.su.domains/ElemStatLearn/">The Elements of Statistical Learning</a>
                    {' '}(Hastie et al.), §14.5 Principal Components, Curves and Surfaces, p. 534
                  </td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>
                    <strong>Introduction to Neural Networks</strong>
                    <p>Perceptron, multilayer perceptron, backpropagation</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://hastie.su.domains/ElemStatLearn/">The Elements of Statistical Learning</a>
                    {' '}(Hastie et al.), §4.5 Separating Hyperplanes, p. 129<br />
                    2.{' '}
                    <a href="https://cs231n.stanford.edu/handouts/derivatives.pdf" target="_blank" rel="noopener noreferrer">
                      Derivatives, Backpropagation, and Vectorization
                    </a><br />
                    3.{' '}
                    <a href="https://web.stanford.edu/class/cs224n/readings/gradient-notes.pdf" target="_blank" rel="noopener noreferrer">
                      Computing Neural Network Gradients
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>4</td>
                  <td>
                    <strong>Neural Network Training</strong>
                    <p>Activation functions, entropy, optimizers (SGD, Adam), regularization</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://d2l.ai/chapter_linear-classification/softmax-regression.html#softmax-regression" target="_blank" rel="noopener noreferrer">
                      Softmax Regression
                    </a>{' '}(Dive into Deep Learning)<br />
                    2.{' '}
                    <a href="https://arxiv.org/pdf/1412.6980">Adam: A Method for Stochastic Optimization</a><br />
                    3.{' '}
                    <a href="https://www.jmlr.org/papers/volume15/srivastava14a/srivastava14a.pdf">
                      Dropout: A Simple Way to Prevent Neural Networks from Overfitting
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>5</td>
                  <td>
                    <strong>Word Embeddings</strong>
                    <p>Word vectors, Word2Vec, distributed representations</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://d2l.ai/chapter_natural-language-processing-pretraining/word2vec.html#word-embedding-word2vec" target="_blank" rel="noopener noreferrer">
                      Word Embedding (word2vec)
                    </a>{' '}(Dive into Deep Learning)<br />
                    2.{' '}
                    <a href="https://arxiv.org/pdf/1301.3781">
                      Efficient Estimation of Word Representations in Vector Space
                    </a>{' '}(word2vec paper)<br />
                    <span className="deadline-note">
                      <strong>Deadline:</strong>{' '}
                      <Link href="/guidelines">Research project proposal</Link> due
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>6</td>
                  <td>
                    <strong>Recurrent Neural Networks &amp; Language Models</strong>
                    <p>RNNs, backpropagation through time, LSTM, GRU; language modeling, sequence generation, sampling strategies</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://www.deeplearningbook.org/contents/rnn.html">
                      Sequence Modeling: Recurrent and Recursive Nets
                    </a>{' '}(Goodfellow et al., Deep Learning)<br />
                    2.{' '}
                    <a href="https://arxiv.org/abs/1211.5063" target="_blank" rel="noopener noreferrer">
                      On the difficulty of training Recurrent Neural Networks
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>7</td>
                  <td>
                    <strong>Seq2Seq &amp; Attention</strong>
                    <p>Sequence-to-sequence encoders and decoders, and attention mechanisms for alignment</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://arxiv.org/pdf/1409.3215">
                      Sequence to Sequence Learning with Neural Networks
                    </a>{' '}(seq2seq paper)<br />
                    2.{' '}
                    <a href="https://arxiv.org/pdf/1409.0473">
                      Neural Machine Translation by Jointly Learning to Align and Translate
                    </a>{' '}(Bahdanau attention paper)
                  </td>
                </tr>
                <tr>
                  <td>8</td>
                  <td>
                    <strong>Transformers</strong>
                    <p>Self-attention, multi-head attention, positional encoding, encoder–decoder stacks</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://arxiv.org/pdf/1706.03762">Attention Is All You Need</a>{' '}(Transformer paper)<br />
                    2.{' '}
                    <a href="https://arxiv.org/pdf/1607.06450">Layer Normalization</a>
                  </td>
                </tr>
                <tr>
                  <td>9</td>
                  <td>
                    <strong>Pre-trained Models: BERT &amp; GPT</strong>
                    <p>Transfer learning, fine-tuning, masked language modeling</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://arxiv.org/pdf/1810.04805">
                      BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding
                    </a><br />
                    2.{' '}
                    <a href="https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf">
                      Improving Language Understanding by Generative Pre-Training
                    </a>{' '}(GPT paper)
                  </td>
                </tr>
                <tr>
                  <td>10</td>
                  <td>
                    <strong>Advanced NLP Techniques</strong>
                    <p>LoRA, FAISS, Retrieval-Augmented Generation (RAG)</p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://arxiv.org/pdf/2106.09685">LoRA: Low-Rank Adaptation of Large Language Models</a><br />
                    2.{' '}
                    <a href="https://proceedings.neurips.cc/paper/2020/file/6b493230205f780e1bc26945df7481e5-Paper.pdf">
                      Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>11</td>
                  <td>
                    <strong>Language &amp; Vision: CNNs and Captioning</strong>
                    <p>Convolutional neural networks, image description generation</p>
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td>12</td>
                  <td>
                    <strong>Generative Models: VAEs &amp; GANs</strong>
                    <p>
                      Variational autoencoders, GANs, discrete latents (VQ-VAE), and VQGAN—bridging to latent
                      diffusion
                    </p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://arxiv.org/pdf/1312.6114">Auto-Encoding Variational Bayes</a><br />
                    2.{' '}
                    <a href="https://arxiv.org/pdf/1406.2661">Generative Adversarial Networks</a>
                    <br />
                    3.{' '}
                    <a href="https://arxiv.org/abs/1711.00937">Neural Discrete Representation Learning</a>{' '}
                    (VQ-VAE)<br />
                    4.{' '}
                    <a href="https://arxiv.org/abs/1906.00446">Generating Diverse High-Fidelity Images with VQ-VAE-2</a>
                    <br />
                    5.{' '}
                    <a href="https://arxiv.org/abs/2012.09841">Taming Transformers for High-Resolution Image Synthesis</a>{' '}
                    (VQGAN)
                  </td>
                </tr>
                <tr>
                  <td>13</td>
                  <td>
                    <strong>Generative Models: Diffusion</strong>
                    <p>
                      Diffusion and score-based SDEs, latent diffusion (Stable Diffusion), guidance, DiT/SiT,
                      text-to-image generation
                    </p>
                  </td>
                  <td>
                    <strong>Readings:</strong><br />
                    1.{' '}
                    <a href="https://arxiv.org/pdf/2006.11239">Denoising Diffusion Probabilistic Models</a>{' '}(DDPM paper)<br />
                    2.{' '}
                    <a href="https://arxiv.org/pdf/2105.05233">Diffusion Models Beat GANs on Image Synthesis</a><br />
                    3.{' '}
                    <a href="https://arxiv.org/pdf/2112.10752">High-Resolution Image Synthesis with Latent Diffusion Models</a>{' '}(Stable Diffusion paper)<br />
                    4.{' '}
                    <a href="https://arxiv.org/pdf/2212.09748">Scalable Diffusion Models with Transformers</a>{' '}(DiT paper)<br />
                    5.{' '}
                    <a href="https://arxiv.org/pdf/2207.12598">Classifier-Free Diffusion Guidance</a>
                    <br />
                    6.{' '}
                    <a href="https://arxiv.org/abs/2011.13456">
                      Score-Based Generative Modeling through Stochastic Differential Equations
                    </a>
                    <br />
                    7.{' '}
                    <a href="https://arxiv.org/abs/2401.08740">
                      SiT: Exploring Flow and Diffusion-based Generative Models with Scalable Interpolant Transformers
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>14</td>
                  <td>
                    <strong>Project Presentations</strong>
                    <p>Student project demos and discussions</p>
                  </td>
                  <td>
                    <Link href="/guidelines">Guidelines</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div id="programming-assignments" className="programming-assignments">
            <h3>Programming Assignments</h3>
            <p className="section-intro syllabus-note">The list below is subject to change.</p>
            <ol className="program-list">
              <li>Program 1: Machine Learning &amp; NLP Fundamentals</li>
              <li>Program 2: Word Embeddings, RNNs, Seq2Seq, Attention, and Transformers</li>
              <li>Program 3: Advanced Topics (e.g. pre-trained models, RAG)</li>
            </ol>
            <ul className="program-rules">
              <li>Each programming assignment is worth <strong>15%</strong> of the final grade.</li>
              <li>Students are encouraged to work in teams of 2.</li>
              <li>There will be two to four programs in total during the semester. Late submissions are not accepted.</li>
            </ul>
          </div>

          <div className="course-details-grid">
            <div className="detail-card">
              <h4>Grading</h4>
              <ul className="grading-list">
                <li>
                  <span><Link href="/guidelines">Research Project</Link></span>
                  <span>40%</span>
                </li>
                <li>
                  <span><a href="#programming-assignments">Programming Assignments</a></span>
                  <span>45%</span>
                </li>
                <li>
                  <span>Class Exercises</span>
                  <span>15%</span>
                </li>
              </ul>
            </div>
            <div className="detail-card">
              <h4>Grading Scale</h4>
              <ul className="scale-list">
                <li><span>≥ 95</span><span>10</span></li>
                <li><span>85 - 94</span><span>9</span></li>
                <li><span>75 - 84</span><span>8</span></li>
                <li><span>65 - 74</span><span>7</span></li>
                <li><span>60 - 64</span><span>6</span></li>
                <li><span>25 - 59</span><span>5</span></li>
                <li><span>≤ 25</span><span>NP</span></li>
              </ul>
            </div>
            <div className="detail-card bibliography">
              <h4>Bibliography</h4>
              <p><strong>Machine Learning:</strong></p>
              <ul>
                <li>
                  Hastie et al.{' '}
                  <em>
                    <a href="https://hastie.su.domains/ElemStatLearn/">The Elements of Statistical Learning</a>
                  </em>
                  , Springer, 2009
                </li>
              </ul>
              <p><strong>Neural Networks:</strong></p>
              <ul>
                <li>
                  Goodfellow et al.{' '}
                  <em>
                    <a href="https://www.deeplearningbook.org/" target="_blank" rel="noopener noreferrer">Deep Learning</a>
                  </em>
                  , MIT Press, 2016
                </li>
                <li>
                  Zhang et al.{' '}
                  <em>
                    <a href="https://d2l.ai/" target="_blank" rel="noopener noreferrer">Dive into Deep Learning</a>
                  </em>
                  , 2021
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Preview */}
      <section id="testimonials" className="section">
        <div className="container">
          <h2>Student Experiences</h2>
          <p className="section-intro">Hear what previous students have to say about their experience in this course.</p>
          <div className="testimonials-grid">
            <TestimonialCard
              quote="La materia fue mucho más interesante y entretenida de lo que llegué a pensar."
              semester="Semester 2026-1"
            />
            <TestimonialCard
              quote="Es muy buen profesor y es muy bueno en la materia, sabe mucho y muchas gracias por todo."
              semester="Semester 2025-2"
            />
            <TestimonialCard
              quote="Excelente curso, complicado pero extremadamente útil e interesante."
              semester="Semester 2024-1"
            />
          </div>
          <div className="see-all-link">
            <Link href="/testimonials" className="btn-primary">See all experiences →</Link>
          </div>
        </div>
      </section>

      {/* Instructor */}
      <section id="instructor" className="section section-alt">
        <div className="container">
          <h2>Instructor</h2>
          <div className="instructor-card">
            <div className="instructor-info">
              <h3>Prof. Emilio Morales</h3>
              <p className="title">The School of Engineering of the National Autonomous University of Mexico</p>
              <p className="bio">
                Research interests include natural language processing, deep learning, diffusion models, GANs,
                music generation, audio and video processing.
              </p>
              <div className="contact-info">
                <p>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:emilio.morales@ciencias.unam.mx">emilio.morales@ciencias.unam.mx</a>
                </p>
                <p><strong>Institution:</strong> School of Engineering, UNAM</p>
                <p><strong>Location:</strong> Ciudad Universitaria, CDMX</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
