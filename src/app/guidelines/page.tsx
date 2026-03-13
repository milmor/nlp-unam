import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Research Project Guidelines - NLP with Deep Learning - UNAM',
};

export default function GuidelinesPage() {
  return (
    <section className="section">
      <div className="container">
        <h2>Research Project Guidelines</h2>
        <p className="section-intro">The research project counts for 40% of the final grade.</p>

        <div className="prereq-info" style={{ marginTop: '1.5rem' }}>
          <h3>Scope &amp; topics</h3>
          <p>
            The project should explore the limits of natural language processing; novel ideas are encouraged
            and the topic is open within this scope. Examples include:
          </p>
          <ul>
            <li>Proposal and evaluation of new algorithms or neural network architectures for NLP</li>
            <li>Research on applications of NLP</li>
            <li>Evaluation of deep learning models in NLP</li>
            <li>Study of NLP applied to different modalities: audio, images, etc.</li>
          </ul>

          <h3>Proposal (due Week 5)</h3>
          <p>
            Submit your research proposal as a <strong>PDF</strong> by the end of Week 5. Your submission
            must include:
          </p>
          <ul>
            <li>Title and brief description of the problem</li>
            <li>Motivation and relevance to the course</li>
            <li>Link(s) to the paper(s) on which you plan to base your project</li>
            <li>Link(s) to the dataset(s) you intend to use</li>
            <li>Proposed approach (model/architecture, evaluation plan)</li>
            <li>Expected deliverables and timeline</li>
          </ul>
          <p>
            <strong>Tip:</strong> Prefer papers for which public datasets are available. Later classes and
            programming sessions will cover more material that may be useful for your project.
          </p>
          <p>Send the proposal to the instructor by the deadline indicated in the syllabus.</p>

          <h4>Finding papers and datasets</h4>
          <p>
            For <strong>papers</strong>, search{' '}
            <a href="https://arxiv.org/" target="_blank" rel="noopener noreferrer">arXiv</a> (e.g. cs.CL,
            cs.LG) and consider work published at ICLR, NeurIPS, ICML, AAAI, ACL, EMNLP, NAACL, EACL,
            CoNLL, and related conferences and workshops. For <strong>datasets</strong>, you can use{' '}
            <a href="https://www.kaggle.com/" target="_blank" rel="noopener noreferrer">Kaggle</a> and other
            data repositories (do not limit yourself to one source).
          </p>

          <h4>Suggested articles for project ideas</h4>
          <p>The following list may help you choose a topic or base your project on one of these papers.</p>
          <ol className="article-list">
            <li>
              <a href="https://arxiv.org/abs/2501.12948" target="_blank" rel="noopener noreferrer">
                DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2103.12407" target="_blank" rel="noopener noreferrer">
                Detecting Hate Speech with GPT-3
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/1905.05583" target="_blank" rel="noopener noreferrer">
                How to Fine-Tune BERT for Text Classification?
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/1502.03044" target="_blank" rel="noopener noreferrer">
                Show, Attend and Tell: Neural Image Caption Generation with Visual Attention
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2405.04517" target="_blank" rel="noopener noreferrer">
                xLSTM: Extended Long Short-Term Memory
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/1409.3215" target="_blank" rel="noopener noreferrer">
                Sequence to Sequence Learning with Neural Networks
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noopener noreferrer">
                Attention Is All You Need
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/1810.04805" target="_blank" rel="noopener noreferrer">
                BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/1910.10683" target="_blank" rel="noopener noreferrer">
                T5: Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2001.08361" target="_blank" rel="noopener noreferrer">
                Scaling Laws for Neural Language Models
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2005.14165" target="_blank" rel="noopener noreferrer">
                Language Models are Few-Shot Learners
              </a>{' '}
              (GPT-3)
            </li>
            <li>
              <a
                href="https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Improving Language Understanding by Generative Pre-Training
              </a>{' '}
              (GPT-1)
            </li>
            <li>
              <a
                href="https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Language Models are Unsupervised Multitask Learners
              </a>{' '}
              (GPT-2)
            </li>
            <li>
              <a href="https://arxiv.org/abs/2103.00020" target="_blank" rel="noopener noreferrer">
                Learning Transferable Visual Models From Natural Language Supervision
              </a>{' '}
              (CLIP)
            </li>
            <li>
              <a href="https://arxiv.org/abs/2302.13971" target="_blank" rel="noopener noreferrer">
                LLaMA: Open and Efficient Foundation Language Models
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2112.10752" target="_blank" rel="noopener noreferrer">
                High-Resolution Image Synthesis with Latent Diffusion Models
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2203.02155" target="_blank" rel="noopener noreferrer">
                Training Language Models to Follow Instructions with Human Feedback
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2305.18290" target="_blank" rel="noopener noreferrer">
                Direct Preference Optimization: Your Language Model is Secretly a Reward Model
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2307.09288" target="_blank" rel="noopener noreferrer">
                Llama 2: Open Foundation and Fine-Tuned Chat Models
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2006.11239" target="_blank" rel="noopener noreferrer">
                Denoising Diffusion Probabilistic Models
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/1910.01108" target="_blank" rel="noopener noreferrer">
                DistilBERT, a distilled version of BERT: smaller, faster, cheaper and lighter
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2106.09685" target="_blank" rel="noopener noreferrer">
                LoRA: Low-Rank Adaptation of Large Language Models
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2310.06825" target="_blank" rel="noopener noreferrer">
                Mistral 7B
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2312.00752" target="_blank" rel="noopener noreferrer">
                Mamba: Linear-Time Sequence Modeling with Selective State Spaces
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2312.13771" target="_blank" rel="noopener noreferrer">
                AppAgent: Multimodal Agents as Smartphone Users
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/1801.06146" target="_blank" rel="noopener noreferrer">
                Universal Language Model Fine-tuning for Text Classification
              </a>{' '}
              (ULMFiT)
            </li>
            <li>
              <a href="https://arxiv.org/abs/2302.04761" target="_blank" rel="noopener noreferrer">
                Toolformer: Language Models Can Teach Themselves to Use Tools
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2201.11903" target="_blank" rel="noopener noreferrer">
                Chain-of-Thought Prompting Elicits Reasoning in Large Language Models
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2005.11401" target="_blank" rel="noopener noreferrer">
                Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2009.03300" target="_blank" rel="noopener noreferrer">
                Measuring Massive Multitask Language Understanding
              </a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2211.09110" target="_blank" rel="noopener noreferrer">
                Holistic Evaluation of Language Models
              </a>
            </li>
          </ol>

          <h3>Deliverables</h3>
          <ul>
            <li>
              <strong>Report:</strong> Written report describing problem, method, experiments, and results
              (length and format as specified by the instructor).
            </li>
            <li>
              <strong>Code:</strong> Clean, documented code and (if applicable) instructions to reproduce
              experiments. You may host the code in a{' '}
              <a href="https://github.com/" target="_blank" rel="noopener noreferrer">GitHub</a> repository
              (or similar) and share the link.
            </li>
            <li>
              <strong>Presentation:</strong> Oral presentation in the final weeks of the course (Week 15).
            </li>
          </ul>

          <h3>Presentation (Week 15)</h3>
          <p>
            Each team or student presents the project in class: problem, approach, main results, and
            conclusions. Time and format will be announced during the semester.
          </p>

          <h3>Questions</h3>
          <p>
            For doubts about the project or proposal, contact the instructor:{' '}
            <a href="mailto:emilio.morales@ciencias.unam.mx">emilio.morales@ciencias.unam.mx</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
