import React from "react";
import profileData from "./profileData";
import ProfileRead from "./ProfileRead";
import Header from "./Header";

export default function Dashboard() {
  const profileDataset = profileData.map((menu) => {
    return (
      <>
        <ProfileRead img={menu.img} text={menu.text} className="profilewrap" />
      </>
    );
  });
  return (
    <>
      <div className="header-get">
        <Header />
      </div>
      <div className="dashboard">
        <div className="left-dashboard">
          <h2 className="dash-title">Happy reading James</h2>
          <div className="dash-control">
            <div className="profile">
              <div className="left-profile">
                <img
                  src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729703890/ARN/login_ifmcrd.jpg"
                  className="profile-img"
                />
                <p>Wednesday 8pm</p>
              </div>
              <div className="right-profile">
                <h2>James Ngandu</h2>
                <input
                  type="text"
                  name="book"
                  placeholder="Hardy Boys"
                  className="input"
                />
                <a href="#">Continue reading</a>
              </div>
            </div>
            <div className="profile-more">
              <div className="input profile-input data-set">
                {profileDataset}
              </div>
              <div className="input profile-input upload">
                <img src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729704805/ARN/progress_rrjr4t.png" />
                Upload files
              </div>
            </div>
          </div>
        </div>

        <div className="centered">
          <input
            type="text"
            className="input search-book"
            name="search"
            placeholder="search book"
          />
          <div className="centre-dashboard">
            <div className="book-page">
              <h2>CHAPTER 2</h2>
              <p>
                Blossoms of the Savannah" is a novel by Kenyan author Henry Ole
                Kulet. It is a poignant story that explores the themes of female
                circumcision, early marriage, and the struggle for education and
                empowerment among the Maasai people in Kenya. The narrative
                follows the lives of two sisters, Resian and Taiyo, as they
                navigate the challenges and expectations of their traditional
                Maasai community. Resian and Taiyo are daughters of Ole Kaelo, a
                wealthy and respected man who has moved his family from Nakuru
                to Nasila, a rural Maasai village. As they settle into their new
                life, the sisters are confronted with the harsh realities of
                Maasai customs, particularly those concerning the roles and
                treatment of women. Resian, the elder sister, is strong-willed
                and determined to pursue her education and resist the pressures
                of early marriage and female circumcision, practices that are
                deeply ingrained in the Maasai culture. Taiyo, on the other
                hand, is more compliant and tries to find a balance between her
                personal desires and the expectations of her community. The
                novel delves into the internal conflict experienced by the
                sisters as they grapple with their identities and the desire to
                break free from the oppressive traditions that limit their
                potential. Resian's defiance and determination to fight for her
                rights and those of other girls in her community put her at odds
                with her father and other village elders, who view her as a
                threat to their way of life. Taiyo, meanwhile, struggles with
                her own aspirations and the fear of disappointing her family and
                community. As the story unfolds, the sisters' journey becomes a
                symbol of hope and resilience for many young Maasai girls who
                aspire to live life on their own terms. The novel highlights the
                importance of education and empowerment in breaking the cycle of
                gender-based discrimination and violence. It also sheds light on
                the complexities of cultural traditions and the need for
                dialogue and understanding in fostering change. "Blossoms of the
                Savannah" is a moving and thought-provoking tale that challenges
                readers to reflect on the societal norms and values that shape
                our lives. Through the experiences of Resian and Taiyo, the
                novel underscores the power of courage, determination, and the
                human spirit in overcoming adversity and paving the way for a
                brighter future
              </p>
            </div>
            <div className="main-nav">
              <p>Previous</p>
              <p>page 10</p>
              <p>Next</p>
            </div>
          </div>
        </div>

        <div className="right-dashboard">
          <h2 className="dash-title">Hardy boys</h2>
          <div className="right-control">
            <img src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729704806/ARN/book_qcojey.jpg" />
            <p id="right-title">
              A mystery book about two brothers and their friends as they try to
              investigate strange happenings on skull mountain
            </p>
            <div className="progress">
              <div className="percentage">
                <img src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729704805/ARN/progress_rrjr4t.png" />
                <p>Progress</p>
              </div>
              <div className="streak">
                <img src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729704804/ARN/streak_kejq7i.jpg" />
                <p>Streak5 Days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
