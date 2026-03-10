import pg from "pg";
import bcryptjs from "bcryptjs";

const pool = new pg.Pool({
  user: process.env.PG_USER || "mukuvi",
  password: process.env.PG_PASSWORD || "arnio2024",
  host: process.env.PG_HOST || "localhost",
  port: parseInt(process.env.PG_PORT || "5432"),
  database: process.env.PG_DATABASE || "arnio",
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        profile_pic TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        bio TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        description TEXT,
        cover_url TEXT,
        genre TEXT,
        pages INTEGER DEFAULT 0,
        published_year INTEGER,
        rating REAL DEFAULT 0,
        uploaded_by INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        chapter_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        UNIQUE(book_id, chapter_number)
      );

      CREATE TABLE IF NOT EXISTS reading_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        current_chapter INTEGER DEFAULT 1,
        progress_percent REAL DEFAULT 0,
        streak_days INTEGER DEFAULT 0,
        last_read TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, book_id)
      );

      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        chapter_number INTEGER,
        content TEXT NOT NULL,
        note_type TEXT DEFAULT 'note',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_chats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reading_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        minutes_read INTEGER DEFAULT 0,
        pages_read INTEGER DEFAULT 0,
        session_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed admin
    const adminCheck = await client.query("SELECT id FROM users WHERE email = $1", ["mukuvi@arnio.com"]);
    if (adminCheck.rows.length === 0) {
      const hashedPw = bcryptjs.hashSync("mukuvi", 10);
      await client.query(
        "INSERT INTO users (name, email, password, profile_pic, role, bio, last_login) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
        ["Mukuvi", "mukuvi@arnio.com", hashedPw, "https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&name=Mukuvi", "admin", "ARN.IO Platform Administrator"]
      );
      console.log("Admin account created: mukuvi@arnio.com");
    }

    // Seed books
    const bookCount = await client.query("SELECT COUNT(*) as count FROM books");
    if (parseInt(bookCount.rows[0].count) === 0) {
      async function seedBook(title, author, desc, cover, genre, pages, year, rating, chapters) {
        const res = await client.query(
          "INSERT INTO books (title,author,description,cover_url,genre,pages,published_year,rating) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
          [title, author, desc, cover, genre, pages, year, rating]
        );
        const bookId = res.rows[0].id;
        for (let i = 0; i < chapters.length; i++) {
          await client.query(
            "INSERT INTO chapters (book_id, chapter_number, title, content) VALUES ($1,$2,$3,$4)",
            [bookId, i + 1, chapters[i].title, chapters[i].content]
          );
        }
        return bookId;
      }

      await seedBook("Blossoms of the Savannah","Henry Ole Kulet","A poignant story exploring themes of education, culture, and the courage to challenge deeply-rooted traditions among the Maasai people of Kenya.","https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop","Fiction",288,2008,4.2,[
        {title:"The Homecoming",content:"Ole Kaelo's transfer from Nakuru to Nasila was not voluntary. It was a consequence of the ongoing restructuring at the company where he worked. When the directive came, he felt uprooted, like a tree torn from fertile soil and replanted in the arid savannah.\n\nHis wife, Mama Milanoi, received the news with quiet resignation. She had grown accustomed to city life \u2014 the convenience of running water, electricity that didn't falter, and neighbors who minded their own business. Nasila was different. Nasila was tradition.\n\nTheir two daughters, Taiyo and Resian, were the ones most affected. Taiyo, the elder, was a music enthusiast with dreams that stretched far beyond the plains. Resian, quieter but equally determined, harbored aspirations of joining Egerton University to study veterinary science.\n\n\"We'll adapt,\" Ole Kaelo told his family, though his voice carried little conviction. \"Nasila is where our roots are.\"\n\nThe journey from Nakuru took most of the day. As they drove deeper into Maasai territory, the landscape shifted \u2014 green hills giving way to golden grasslands that shimmered under the afternoon sun. Cattle dotted the plains, tended by young morans with ochre-painted hair.\n\nResian pressed her face against the window. \"It's beautiful,\" she whispered, \"but it feels so far from everything.\"\n\nTaiyo reached for her sister's hand. \"We have each other. That's enough.\"\n\nWhen they arrived at their new home, a crowd had gathered. The women ululated, the men stood in stoic welcome. Ole Kaelo's brother, Simiren, stepped forward with open arms.\n\n\"Welcome home, brother. The savannah has missed you.\"\n\nBut beneath the warm welcome, currents of expectation swirled. The elders had plans for the Kaelo daughters \u2014 plans rooted in tradition that the sisters couldn't yet imagine."},
        {title:"Whispers of Tradition",content:"The first weeks in Nasila passed in a blur of adjustment. Mama Milanoi busied herself with organizing the household, while Ole Kaelo reconnected with his clan. The daughters explored their new world cautiously.\n\nTaiyo discovered the beauty of the landscape \u2014 the way the morning mist settled over the valleys, the sound of the river that wound through the property, and the birds whose songs filled the dawn air.\n\nBut it was at the market that reality first struck. An older woman, Nasilu, approached her with practiced friendliness.\n\n\"So you are Kaelo's daughter,\" Nasilu said, her eyes appraising. \"You are of age, I see. Has your father spoken with the enkamuratani?\"\n\nTaiyo didn't understand the reference but felt a chill run through her. When she asked her mother later, Mama Milanoi's face grew tight.\n\n\"Some traditions persist,\" was all she would say.\n\nResian, meanwhile, was having her own encounters. At the local school where she volunteered, she met Olarinkoi, a young man whose attention felt less like friendliness and more like ownership.\n\n\"Your father and my father are in discussions,\" he told her casually one afternoon. \"About our future.\"\n\n\"I have plans,\" Resian replied firmly. \"I'm going to university.\"\n\nOlarinkoi laughed \u2014 not cruelly, but with the assured confidence of someone who believed the world worked according to ancient rules.\n\nThat evening, the sisters sat together under a sky blazing with stars.\n\n\"Something is happening,\" Taiyo said quietly. \"Something we need to understand before it's too late.\"\n\n\"Then we learn fast,\" Resian replied. \"And we fight if we must.\"\n\nThe savannah winds carried their words into the darkness, where traditions older than memory stirred restlessly."},
        {title:"Seeds of Resistance",content:"Knowledge, the sisters discovered, was both shield and weapon.\n\nTaiyo began attending community gatherings, listening to the elders discuss customs and expectations. She learned that the ceremony Nasilu had referenced was female circumcision \u2014 a rite the community considered essential for any girl approaching marriage.\n\n\"Without it, no man of standing will take you,\" an elder woman explained matter-of-factly. \"You remain a child forever.\"\n\nTaiyo's stomach turned, but she kept her composure. She needed information, not confrontation. Not yet.\n\nResian found an ally in Minik, a woman who ran a small education center on the outskirts of Nasila. Minik had once been like them \u2014 young, ambitious, and trapped between two worlds.\n\n\"I was cut when I was fourteen,\" Minik told her, her voice steady but her eyes reflecting old pain. \"I nearly died from the bleeding. When I recovered, I vowed no other girl would suffer if I could help it.\"\n\nMinik's center provided scholarships for girls to attend secondary school and university. She had connections to organizations in Nairobi that could help.\n\n\"But you must act soon,\" Minik warned. \"Once the elders set a date, your father will find it impossible to refuse.\"\n\nThe sisters hatched a plan. Taiyo would keep the family occupied with preparations for a cultural music festival \u2014 her talent was respected even by traditionalists. Resian would quietly apply to Egerton through Minik's network.\n\nBut plans, no matter how careful, have a way of unraveling in Nasila. When Ole Kaelo discovered a letter from Egerton addressed to Resian, the fragile peace of the household shattered.\n\n\"You go behind my back?\" he thundered. \"In my own house?\"\n\n\"It's my life, Father,\" Resian said, her voice trembling but her eyes steady. \"And I won't let anyone take it from me.\"\n\nThe savannah, ancient witness to countless such battles, held its breath."}
      ]);

      await seedBook("Hardy Boys: The Tower Treasure","Franklin W. Dixon","The very first Hardy Boys mystery! Frank and Joe Hardy search for a stolen treasure hidden somewhere in a mysterious old tower.","https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop","Mystery",180,1927,4.0,[
        {title:"The Speed Demon",content:"Frank and Joe Hardy clutched the grips of their motorcycles and headed along the shore road, racing toward the cliffside. The boys had reason to hurry \u2014 their father, Fenton Hardy, the famous detective, had sent word that he needed them immediately.\n\nFrank, dark-haired and eighteen, took the lead. Joe, a year younger with fair hair, followed close behind. The road wound along Barmet Bay, with the ocean crashing against the rocks far below.\n\n\"Car ahead!\" Frank shouted, as a red jalopy appeared around the bend, weaving dangerously across both lanes.\n\nThe boys swerved hard. The car rocketed past them, horn blaring, the driver's face a snarl of concentration. In the passenger seat, Frank glimpsed something that made his detective instincts tingle \u2014 a man clutching a leather satchel to his chest with both arms.\n\n\"Did you see that?\" Joe pulled alongside his brother as the car disappeared around the cliff.\n\n\"I saw it. That car was stolen \u2014 the plates were muddy, probably covered on purpose.\"\n\nThey continued home to find their father in his study, poring over a case file. Fenton Hardy was tall, with keen eyes that missed nothing.\n\n\"Boys, sit down. Hurd Applegate called this morning. His house was robbed last night \u2014 jewelry and securities worth forty thousand dollars. The Tower Mansion.\"\n\nFrank and Joe exchanged excited glances. Tower Mansion was Bayport's most famous building \u2014 an old stone estate with two tall towers that overlooked the entire harbor.\n\n\"The police have a suspect,\" their father continued. \"Henry Robinson, the caretaker. But I don't think he did it.\"\n\n\"Then who did?\" Joe asked.\n\n\"That,\" Fenton Hardy said with a slight smile, \"is what we're going to find out.\""},
        {title:"The Robbery at Tower Mansion",content:"Tower Mansion stood on a hill at the edge of Bayport, its two stone towers rising like sentinels against the sky. The estate belonged to Hurd Applegate, an elderly stamp collector known for his sharp tongue.\n\nFrank and Joe arrived to find the mansion in chaos. Police Chief Collig was interviewing the staff while his officers dusted for fingerprints.\n\n\"Hardy boys,\" Collig greeted them. \"Your father sent you, I suppose.\"\n\n\"We'd like to look around, if you don't mind,\" Frank said diplomatically.\n\nThe robbery had occurred sometime during the night. The safe in Applegate's study had been expertly cracked.\n\n\"The safe wasn't forced,\" Joe noted, examining the mechanism. \"Someone knew the combination, or they're a world-class safecracker.\"\n\nHenry Robinson, the caretaker, sat in the kitchen looking miserable. He was a mild-mannered man with honest eyes.\n\n\"I didn't do it,\" he said when the boys approached. \"I've worked for Mr. Applegate for twelve years.\"\n\nAs they left the mansion, the boys discussed the case.\n\n\"Robinson's not our man,\" Joe said firmly. \"But someone on the inside must have helped.\"\n\nFrank nodded. \"Remember the car on the shore road? The timing fits. I think whoever robbed Tower Mansion drove right past us.\"\n\n\"Then we find the red car,\" Joe said, \"and we find our thief.\""}
      ]);

      await seedBook("The Art of War","Sun Tzu","An ancient Chinese military treatise whose principles have been adapted for business, leadership, and strategy worldwide.","https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=600&fit=crop","Philosophy",96,-500,4.7,[
        {title:"Laying Plans",content:"Sun Tzu said: The art of war is of vital importance to the State. It is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected.\n\nThe art of war is governed by five constant factors: the Moral Law, Heaven, Earth, the Commander, and Method and Discipline.\n\nThe Moral Law causes the people to be in complete accord with their ruler, so that they will follow him regardless of their lives, undismayed by any danger.\n\nHeaven signifies night and day, cold and heat, times and seasons.\n\nEarth comprises distances, great and small; danger and security; open ground and narrow passes.\n\nThe Commander stands for the virtues of wisdom, sincerity, benevolence, courage, and strictness.\n\nBy Method and Discipline are to be understood the marshaling of the army in its proper subdivisions, the gradations of rank among the officers, the maintenance of roads by which supplies may reach the army.\n\nThese five heads should be familiar to every general: he who knows them will be victorious; he who knows them not will fail."},
        {title:"Waging War",content:"Sun Tzu said: In the operations of war, the expenditure at home and at the front will reach the total of a thousand ounces of silver per day.\n\nWhen you engage in actual fighting, if victory is long in coming, then men's weapons will grow dull and their ardor will be dampened. If you lay siege to a town, you will exhaust your strength.\n\nThus, though we have heard of stupid haste in war, cleverness has never been seen associated with long delays.\n\nThe skillful soldier does not raise a second levy, neither are his supply-wagons loaded more than twice.\n\nIn war, then, let your great object be victory, not lengthy campaigns."}
      ]);

      await seedBook("Pride and Prejudice","Jane Austen","A witty romantic novel following Elizabeth Bennet as she navigates manners, morality, and marriage in Regency-era England.","https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop","Romance",432,1813,4.6,[
        {title:"A Single Man in Possession of a Good Fortune",content:"It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.\n\n\"My dear Mr. Bennet,\" said his lady to him one day, \"have you heard that Netherfield Park is let at last?\"\n\nMr. Bennet replied that he had not.\n\n\"But it is,\" returned she; \"for Mrs. Long has just been here, and she told me all about it.\"\n\nMr. Bennet made no answer.\n\n\"Do you not want to know who has taken it?\" cried his wife impatiently.\n\n\"You want to tell me, and I have no objection to hearing it.\"\n\nThis was invitation enough.\n\n\"Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it, that he agreed with Mr. Morris immediately.\"\n\n\"What is his name?\"\n\n\"Bingley.\"\n\n\"Is he married or single?\"\n\n\"Oh! Single, my dear, to be sure! A single man of large fortune; four or five thousand a year. What a fine thing for our girls!\""},
        {title:"The Assembly Ball",content:"Mr. Bennet was among the earliest of those who waited on Mr. Bingley. Observing his second daughter employed in trimming a hat, he suddenly addressed her:\n\n\"I hope Mr. Bingley will like it, Lizzy.\"\n\nWhen the party entered the assembly room it consisted of only five altogether \u2014 Mr. Bingley, his two sisters, the husband of the eldest, and another young man.\n\nMr. Bingley was good-looking and gentlemanlike; he had a pleasant countenance, and easy, unaffected manners. His friend Mr. Darcy soon drew the attention of the room by his fine, tall person, handsome features, and the report of his having ten thousand a year.\n\nMr. Darcy danced only once with Mrs. Hurst and once with Miss Bingley, declined being introduced to any other lady, and spent the rest of the evening walking about the room. His character was decided. He was the proudest, most disagreeable man in the world.\n\n\"Come, Darcy,\" said Bingley, \"I must have you dance.\"\n\n\"I certainly shall not. There is not another woman in the room whom it would not be a punishment to me to stand up with.\"\n\nElizabeth's spirit rose at the slight."}
      ]);

      await seedBook("Atomic Habits","James Clear","A practical guide to building good habits and breaking bad ones through small changes that deliver remarkable results.","https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&h=600&fit=crop","Self-Help",320,2018,4.8,[
        {title:"The Surprising Power of Atomic Habits",content:"In 2003, the British Cycling team was in a state of mediocrity. Then Dave Brailsford was hired as performance director.\n\nBrailsford believed in \"the aggregation of marginal gains\" \u2014 searching for a tiny margin of improvement in everything you do.\n\nHe optimized nutrition, training, bike ergonomics. He tested massage gels for fastest muscle recovery. He hired a surgeon to teach riders the best way to wash hands to reduce colds. He painted the inside of the team truck white to spot dust.\n\nJust five years later, the British Cycling team dominated the 2008 Olympics in Beijing.\n\nThis is the power of atomic habits. A 1 percent improvement every day for a year results in becoming 37 times better by the end of the year.\n\nHabits are the compound interest of self-improvement. They seem to make little difference on any given day, yet the impact they deliver over months and years can be enormous.\n\nYour outcomes are a lagging measure of your habits. Your net worth is a lagging measure of your financial habits. Your weight is a lagging measure of your eating habits.\n\nYou get what you repeat."},
        {title:"How Your Habits Shape Your Identity",content:"Why is it so easy to repeat bad habits and so hard to form good ones?\n\nThere are three layers of behavior change: outcomes, processes, and identity.\n\nMany people begin by focusing on outcomes. The alternative is identity-based habits \u2014 focusing on who you wish to become.\n\nThe person who says \"I'm trying to quit smoking\" still identifies as a smoker. The person who says \"I'm not a smoker\" has shifted their identity.\n\nEvery action you take is a vote for the type of person you wish to become. No single instance will transform your beliefs, but as the votes build up, so does the evidence of your new identity.\n\nIt's a simple two-step process:\n1. Decide the type of person you want to be.\n2. Prove it to yourself with small wins.\n\nYour identity emerges out of your habits. The word identity was originally derived from the Latin \"essentitas\" (being) and \"identidem\" (repeatedly). Your identity is literally your \"repeated beingness.\"\n\nThe good news is that you can change it at any time."}
      ]);

      await seedBook("Foundations of Chemistry","Dr. Sarah Mitchell","A comprehensive guide to understanding chemistry from atomic structure to organic reactions.","https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=600&fit=crop","Education",420,2020,4.5,[
        {title:"The Atomic World",content:"Everything around you is made of atoms. Understanding atoms is the gateway to understanding all of chemistry.\n\nAn atom is the smallest unit of matter that retains the identity of a chemical element. Every atom consists of three types of subatomic particles:\n\n\u2022 Protons: Positively charged, found in the nucleus. The number of protons defines the element.\n\u2022 Neutrons: Neutral particles in the nucleus. They add mass and help stabilize it.\n\u2022 Electrons: Negatively charged particles in orbitals. They are responsible for chemical bonding.\n\nThe arrangement of electrons determines how an atom behaves chemically. Electrons fill shells in order: the first holds 2, the second 8, the third 18.\n\nThe Periodic Table organizes elements by atomic number. Elements in the same column share similar chemical properties because they have the same number of electrons in their outermost shell.\n\nConsider water (H2O): two hydrogen atoms each share their single electron with an oxygen atom, which needs two more to complete its outer shell. This sharing creates covalent bonds \u2014 the foundation of molecular chemistry."}
      ]);

      await seedBook("Foundations of Physics","Dr. James Maxwell","An introductory physics textbook covering mechanics, thermodynamics, electromagnetism, and modern physics.","https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&h=600&fit=crop","Education",380,2019,4.3,[
        {title:"Motion and Forces",content:"Physics begins with the study of motion. Everything in the universe moves.\n\nNewton formalized our understanding with three laws:\n\nFirst Law (Inertia): An object at rest stays at rest, and an object in motion stays in motion at constant velocity, unless acted upon by an external force.\n\nSecond Law (F = ma): The acceleration of an object equals the net force acting on it divided by its mass.\n\nThird Law (Action-Reaction): For every action, there is an equal and opposite reaction. Rockets work on this principle.\n\nSpeed tells you how fast something moves. Velocity also tells you the direction. Acceleration is the rate of change of velocity.\n\nGravity accelerates objects toward Earth at approximately 9.8 m/s2. These principles explain everything from why bridges stand to how satellites orbit."}
      ]);

      await seedBook("Introduction to Algorithms","Thomas H. Cormen","A comprehensive introduction to modern computer algorithms, accessible to all levels of readers.","https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=600&fit=crop","Computer Science",1312,2009,4.4,[
        {title:"The Role of Algorithms",content:"What are algorithms, and why should you study them?\n\nInformally, an algorithm is any well-defined computational procedure that takes some value as input and produces some value as output. An algorithm is a sequence of computational steps that transform the input into the output.\n\nConsider the sorting problem: given a sequence of n numbers, rearrange them in ascending order. For example, given (31, 41, 59, 26, 41, 58), a sorting algorithm returns (26, 31, 41, 41, 58, 59).\n\nSorting is fundamental in computer science. Which algorithm is best depends on how many items need sorted, whether they're already partially sorted, and practical constraints.\n\nAn algorithm is correct if, for every input instance, it halts with the correct output.\n\nAlgorithms are fundamental to computing. Understanding them is a prerequisite for understanding the power and limitations of computers."}
      ]);

      await seedBook("A Brief History of Time","Stephen Hawking","An exploration of cosmology \u2014 from the Big Bang to black holes, from the nature of time to the search for a unified theory.","https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=600&fit=crop","Science",256,1988,4.5,[
        {title:"Our Picture of the Universe",content:"A well-known scientist once gave a public lecture on astronomy. At the end, a little old lady said: \"What you have told us is rubbish. The world is really a flat plate supported on the back of a giant tortoise.\"\n\nThe scientist asked, \"What is the tortoise standing on?\"\n\n\"It's turtles all the way down!\"\n\nFor centuries, our picture of the universe has evolved. The ancient Greeks believed Earth was the center. Copernicus showed the sun was central. Hubble demonstrated our galaxy was just one among billions.\n\nToday we know the universe began approximately 13.8 billion years ago in the Big Bang. Space has been expanding ever since. Galaxies fly apart, and the further away a galaxy is, the faster it recedes.\n\nThe most remarkable discovery of modern physics is that the universe is governed by mathematical laws that apply everywhere, from the smallest quantum to the largest supercluster."}
      ]);

      await seedBook("The Psychology of Money","Morgan Housel","Timeless lessons on wealth, greed, and happiness \u2014 exploring the strange ways people think about money.","https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=600&fit=crop","Finance",256,2020,4.7,[
        {title:"No One's Crazy",content:"People do some crazy things with money. But no one is crazy.\n\nPeople from different generations, raised by different parents who earned different incomes, in different parts of the world, learn very different lessons.\n\nEveryone has their own unique experience with how the world works. What seems crazy to you might make perfect sense to me.\n\nThe person who grew up in poverty thinks about risk in ways the child of a wealthy banker cannot fathom. The person who came of age during hyperinflation sees the world through a different lens.\n\nWe all think we know how the world works. But we've all only experienced a tiny sliver of it.\n\nThe challenge is that no amount of studying can genuinely recreate the power of fear and uncertainty. We can read about the Great Depression, but we can't feel it.\n\nAnd so, people do what makes sense to them in the moment, based on their unique experiences.\n\nThat's not crazy. That's human."}
      ]);

      console.log("Seeded 10 books with chapters");
    }
  } finally {
    client.release();
  }
}

export default pool;
